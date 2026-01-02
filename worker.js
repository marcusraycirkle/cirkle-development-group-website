/**
 * Cirkle Development Group - Cloudflare Workers API
 * Handles authentication, user data, and MyCirkle integration
 */

// Admin Discord IDs - these users get admin privileges automatically
const ADMIN_DISCORD_IDS = [
  '1088907566844739624', // Marcus Ray
  '926568979747713095',  // Teejay Everil
  '1187751127039615086', // Sam Caster
  '1002932344799371354', // Appler Smith
];

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle CORS preflight requests
function handleOptions(request) {
  return new Response(null, {
    headers: corsHeaders
  });
}

// Simple JWT implementation
async function generateToken(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${header}.${body}.${secret}`)
  );
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${header}.${body}.${signatureBase64}`;
}

async function verifyToken(token, secret) {
  try {
    const [header, payload, signature] = token.split('.');
    const data = JSON.parse(atob(payload));
    
    // Check expiration
    if (data.exp && data.exp < Date.now()) {
      return null;
    }
    
    return data;
  } catch (e) {
    return null;
  }
}

// Helper function to find a reply by ID (including nested)
function findReplyById(replies, replyId) {
  for (const reply of replies) {
    if (reply.id === replyId) return reply;
    if (reply.replies && reply.replies.length > 0) {
      const found = findReplyById(reply.replies, replyId);
      if (found) return found;
    }
  }
  return null;
}

// Helper function to remove a reply by ID (including nested)
function removeReplyById(replies, replyId, user) {
  for (let i = 0; i < replies.length; i++) {
    if (replies[i].id === replyId) {
      // Check if user is authorized (author or admin)
      if (replies[i].authorId !== user.id && !user.isAdmin) {
        return { found: true, authorized: false };
      }
      replies.splice(i, 1);
      return { found: true, authorized: true };
    }
    if (replies[i].replies && replies[i].replies.length > 0) {
      const result = removeReplyById(replies[i].replies, replyId, user);
      if (result.found) return result;
    }
  }
  return { found: false, authorized: false };
}

// Helper to get authenticated user from request
async function getAuthUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  console.log('Auth header present:', !!authHeader);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No valid auth header');
    return null;
  }
  
  const token = authHeader.substring(7);
  console.log('Token prefix:', token.substring(0, 20));
  
  const sessionData = await env.SESSIONS.get(token);
  console.log('Session found:', !!sessionData);
  
  if (!sessionData) {
    return null;
  }
  
  const session = JSON.parse(sessionData);
  if (session.expiresAt < Date.now()) {
    console.log('Session expired');
    await env.SESSIONS.delete(token);
    return null;
  }
  
  const userData = await env.USERS.get(`user:${session.userId}`);
  console.log('User found:', !!userData);
  return userData ? JSON.parse(userData) : null;
}

// Discord OAuth Handler
async function handleDiscordOAuth(env, code) {
  try {
    console.log('Starting Discord OAuth with code:', code.substring(0, 10) + '...');
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: env.DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Discord token exchange failed:', tokenResponse.status, errorData);
      let parsedError;
      try {
        parsedError = JSON.parse(errorData);
      } catch (e) {
        parsedError = { message: errorData };
      }
      return { 
        error: `Discord OAuth failed: ${parsedError.error || 'Unknown error'}`,
        details: parsedError.error_description || errorData
      };
    }

    const tokenData = await tokenResponse.json();
    
    // Get user info from Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const discordUser = await userResponse.json();
    
    return {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      globalName: discordUser.global_name,
      email: discordUser.email,
    };
  } catch (error) {
    console.error('Discord OAuth error:', error);
    return { error: 'Unexpected error during Discord authentication', details: error.message };
  }
}

// MyCirkle Verification Handler
async function verifyMyCirkleMembership(discordId, env) {
  try {
    const response = await fetch('https://mycirkle-auth.marcusray.workers.dev/api/verify-membership', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        discordId: discordId,
      }),
    });

    if (!response.ok) {
      return {
        verified: false,
        message: 'Could not verify membership',
      };
    }

    const data = await response.json();
    return {
      verified: data.verified || false,
      membershipTier: data.tier || 'basic',
      memberSince: data.memberSince || null,
    };
  } catch (error) {
    console.error('MyCirkle verification error:', error);
    return {
      verified: false,
      message: 'Verification service unavailable',
    };
  }
}

// API Route Handlers
const routes = {
  // Health check
  'GET /api/health': async (request, env) => {
    return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Discord OAuth - Get authorization URL
  'GET /api/auth/discord/url': async (request, env) => {
    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      redirect_uri: env.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify email',
    });
    
    const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    
    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Discord OAuth - Handle callback
  'POST /api/auth/discord/callback': async (request, env) => {
    const { code } = await request.json();
    
    const result = await handleDiscordOAuth(env, code);
    if (!result || result.error) {
      return new Response(JSON.stringify({ 
        error: (result && result.error) || 'Discord authentication failed',
        details: result && result.details 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const discordUser = result;

    // Check if user exists
    const existingUserData = await env.USERS.get(`discord:${discordUser.id}`);
    let user;

    if (existingUserData) {
      // Existing user - update data
      user = JSON.parse(existingUserData);
      user.lastLogin = new Date().toISOString();
    } else {
      // New user - create account (pending bio and MyCirkle verification)
      // Check if user is an admin
      const isAdmin = ADMIN_DISCORD_IDS.includes(discordUser.id);
      
      user = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: discordUser.username.toLowerCase().replace(/\s+/g, '_'),
        nickname: discordUser.globalName || discordUser.username,
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        discordDiscriminator: discordUser.discriminator,
        profilePhoto: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(discordUser.username)}&background=5865F2&color=fff&size=128`,
        email: discordUser.email || '',
        pronouns: '',
        bio: '',
        myCirkleVerified: false,
        myCirkleTier: null,
        followers: [],
        following: [],
        isAdmin: isAdmin,
        profileComplete: false,
        suspended: false,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        activityStats: {
          blogsInteracted: 0,
          blogsSuggested: 0,
          commentsPosted: 0,
          blogsAuthored: 0,
        },
      };
    }

    // Create session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      userId: user.id,
      discordId: discordUser.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    };

    await env.SESSIONS.put(sessionId, JSON.stringify(session), {
      expirationTtl: 30 * 24 * 60 * 60, // 30 days
    });

    // Save user data
    await env.USERS.put(`user:${user.id}`, JSON.stringify(user));
    await env.USERS.put(`discord:${discordUser.id}`, JSON.stringify(user));

    // Check if user needs onboarding (profileComplete flag)
    const needsOnboarding = !user.profileComplete;

    return new Response(JSON.stringify({
      sessionId: sessionId,
      user: user,
      isNewUser: needsOnboarding,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Verify MyCirkle membership
  'POST /api/auth/verify-mycirkle': async (request, env) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const verification = await verifyMyCirkleMembership(user.discordId, env);
    
    if (verification.verified) {
      user.myCirkleVerified = true;
      user.myCirkleTier = verification.membershipTier;
      user.myCirkleSince = verification.memberSince;
      
      await env.USERS.put(`user:${user.id}`, JSON.stringify(user));
      await env.USERS.put(`discord:${user.discordId}`, JSON.stringify(user));
    }

    return new Response(JSON.stringify(verification), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Complete profile setup (bio)
  'POST /api/auth/complete-profile': async (request, env) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { bio } = await request.json();
    
    // Validate bio
    if (bio && bio.length > 200) {
      return new Response(JSON.stringify({ error: 'Bio must be 200 characters or less' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const urlPattern = /(https?:\/\/|www\.)/i;
    if (bio && urlPattern.test(bio)) {
      return new Response(JSON.stringify({ error: 'Links are not allowed in bio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    user.bio = bio || '';
    user.profileComplete = true;
    
    await env.USERS.put(`user:${user.id}`, JSON.stringify(user));
    await env.USERS.put(`discord:${user.discordId}`, JSON.stringify(user));

    return new Response(JSON.stringify({ success: true, user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Get current user
  'GET /api/users/me': async (request, env) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(user), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Update user profile
  'PUT /api/users/me': async (request, env) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updates = await request.json();
    
    // Validate and apply updates
    const allowedFields = ['nickname', 'pronouns', 'bio', 'profilePhoto', 'publicEmail'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'bio') {
          if (updates.bio.length > 200) {
            return new Response(JSON.stringify({ error: 'Bio must be 200 characters or less' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          const urlPattern = /(https?:\/\/|www\.)/i;
          if (urlPattern.test(updates.bio)) {
            return new Response(JSON.stringify({ error: 'Links are not allowed in bio' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        if (field === 'publicEmail' && updates.publicEmail) {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(updates.publicEmail)) {
            return new Response(JSON.stringify({ error: 'Invalid email format' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        user[field] = updates[field];
      }
    }

    await env.USERS.put(`user:${user.id}`, JSON.stringify(user));
    await env.USERS.put(`discord:${user.discordId}`, JSON.stringify(user));

    return new Response(JSON.stringify({ success: true, user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Get user by ID
  'GET /api/users/:id': async (request, env, params) => {
    const userData = await env.USERS.get(`user:${params.id}`);
    
    if (!userData) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = JSON.parse(userData);
    
    // Remove sensitive information
    delete user.email;
    delete user.discordDiscriminator;

    return new Response(JSON.stringify(user), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Get all users (for search/discovery)
  'GET /api/users': async (request, env) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    
    // List all users from KV
    const userKeys = await env.USERS.list({ prefix: 'user:' });
    const users = [];
    
    for (const key of userKeys.keys) {
      const userData = await env.USERS.get(key.name);
      if (userData) {
        const user = JSON.parse(userData);
        // Filter by search if provided
        if (search) {
          const searchLower = search.toLowerCase();
          if (!user.username.toLowerCase().includes(searchLower) && 
              !(user.nickname && user.nickname.toLowerCase().includes(searchLower))) {
            continue;
          }
        }
        // Remove sensitive info
        delete user.email;
        delete user.discordDiscriminator;
        users.push(user);
      }
    }
    
    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Follow a user
  'POST /api/users/:id/follow': async (request, env, params) => {
    const currentUser = await getAuthUser(request, env);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetUserId = params.id;
    
    if (currentUser.id === targetUserId) {
      return new Response(JSON.stringify({ error: 'Cannot follow yourself' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get target user
    const targetUserData = await env.USERS.get(`user:${targetUserId}`);
    if (!targetUserData) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const targetUser = JSON.parse(targetUserData);

    // Initialize arrays if needed
    if (!currentUser.following) currentUser.following = [];
    if (!targetUser.followers) targetUser.followers = [];

    // Check if already following
    if (currentUser.following.includes(targetUserId)) {
      return new Response(JSON.stringify({ error: 'Already following this user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add follow relationship
    currentUser.following.push(targetUserId);
    targetUser.followers.push(currentUser.id);

    // Save both users
    await env.USERS.put(`user:${currentUser.id}`, JSON.stringify(currentUser));
    await env.USERS.put(`discord:${currentUser.discordId}`, JSON.stringify(currentUser));
    await env.USERS.put(`user:${targetUser.id}`, JSON.stringify(targetUser));
    await env.USERS.put(`discord:${targetUser.discordId}`, JSON.stringify(targetUser));

    // Create notification for target user
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'new_follower',
      fromUserId: currentUser.id,
      fromUsername: currentUser.nickname || currentUser.username,
      fromPhoto: currentUser.profilePhoto,
      message: `${currentUser.nickname || currentUser.username} started following you`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    
    // Store notification
    const notifKey = `notifications:${targetUserId}`;
    const existingNotifs = await env.USERS.get(notifKey);
    const notifications = existingNotifs ? JSON.parse(existingNotifs) : [];
    notifications.unshift(notification);
    await env.USERS.put(notifKey, JSON.stringify(notifications.slice(0, 50))); // Keep last 50

    return new Response(JSON.stringify({ success: true, following: currentUser.following }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Unfollow a user (POST version for easier frontend)
  'POST /api/users/:id/unfollow': async (request, env, params) => {
    const currentUser = await getAuthUser(request, env);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetUserId = params.id;

    // Get target user
    const targetUserData = await env.USERS.get(`user:${targetUserId}`);
    if (!targetUserData) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const targetUser = JSON.parse(targetUserData);

    // Initialize arrays if needed
    if (!currentUser.following) currentUser.following = [];
    if (!targetUser.followers) targetUser.followers = [];

    // Remove follow relationship
    currentUser.following = currentUser.following.filter(id => id !== targetUserId);
    targetUser.followers = targetUser.followers.filter(id => id !== currentUser.id);

    // Save both users
    await env.USERS.put(`user:${currentUser.id}`, JSON.stringify(currentUser));
    await env.USERS.put(`discord:${currentUser.discordId}`, JSON.stringify(currentUser));
    await env.USERS.put(`user:${targetUser.id}`, JSON.stringify(targetUser));
    await env.USERS.put(`discord:${targetUser.discordId}`, JSON.stringify(targetUser));

    return new Response(JSON.stringify({ success: true, following: currentUser.following }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Unfollow a user (DELETE version)
  'DELETE /api/users/:id/follow': async (request, env, params) => {
    const currentUser = await getAuthUser(request, env);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetUserId = params.id;

    // Get target user
    const targetUserData = await env.USERS.get(`user:${targetUserId}`);
    if (!targetUserData) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const targetUser = JSON.parse(targetUserData);

    // Initialize arrays if needed
    if (!currentUser.following) currentUser.following = [];
    if (!targetUser.followers) targetUser.followers = [];

    // Remove follow relationship
    currentUser.following = currentUser.following.filter(id => id !== targetUserId);
    targetUser.followers = targetUser.followers.filter(id => id !== currentUser.id);

    // Save both users
    await env.USERS.put(`user:${currentUser.id}`, JSON.stringify(currentUser));
    await env.USERS.put(`discord:${currentUser.discordId}`, JSON.stringify(currentUser));
    await env.USERS.put(`user:${targetUser.id}`, JSON.stringify(targetUser));
    await env.USERS.put(`discord:${targetUser.discordId}`, JSON.stringify(targetUser));

    return new Response(JSON.stringify({ success: true, following: currentUser.following }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Get notifications
  'GET /api/notifications': async (request, env) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notifKey = `notifications:${user.id}`;
    const existingNotifs = await env.USERS.get(notifKey);
    const notifications = existingNotifs ? JSON.parse(existingNotifs) : [];

    return new Response(JSON.stringify({ notifications }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Mark notifications as read
  'PUT /api/notifications/read': async (request, env) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notifKey = `notifications:${user.id}`;
    const existingNotifs = await env.USERS.get(notifKey);
    const notifications = existingNotifs ? JSON.parse(existingNotifs) : [];

    // Mark all as read
    notifications.forEach(n => n.read = true);
    await env.USERS.put(notifKey, JSON.stringify(notifications));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Logout
  'POST /api/auth/logout': async (request, env) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await env.SESSIONS.delete(token);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Delete account
  'DELETE /api/users/me': async (request, env) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete user data
    await env.USERS.delete(`user:${user.id}`);
    await env.USERS.delete(`discord:${user.discordId}`);
    
    // Delete all user's sessions
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await env.SESSIONS.delete(token);
    }

    // Note: Comments and blogs remain but are orphaned
    // Could be extended to delete user's comments/blogs if needed

    return new Response(JSON.stringify({ success: true, message: 'Account deleted successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Get all blogs
  'GET /api/blogs': async (request, env) => {
    try {
      const blogsList = await env.BLOGS.list();
      const blogs = [];
      
      for (const key of blogsList.keys) {
        if (key.name.startsWith('blog:')) {
          const blogData = await env.BLOGS.get(key.name);
          if (blogData) {
            const blog = JSON.parse(blogData);
            // Initialize likes/dislikes for existing blogs
            if (typeof blog.likes !== 'number') blog.likes = 0;
            if (typeof blog.dislikes !== 'number') blog.dislikes = 0;
            blogs.push(blog);
          }
        }
      }
      
      // Sort by publish date, newest first
      blogs.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
      
      return new Response(JSON.stringify({ blogs }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error fetching blogs:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch blogs' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },

  // Get user's recent comments across all blogs
  'GET /api/users/:id/comments': async (request, env, params) => {
    const userId = params.id;
    
    // Get all blogs
    const blogsList = await env.BLOGS.list();
    const userComments = [];
    
    for (const key of blogsList.keys) {
      if (key.name.startsWith('blog:')) {
        const blogData = await env.BLOGS.get(key.name);
        if (blogData) {
          const blog = JSON.parse(blogData);
          
          // Find comments by this user
          if (blog.comments && blog.comments.length > 0) {
            for (const comment of blog.comments) {
              if (comment.authorId === userId) {
                userComments.push({
                  id: comment.id,
                  content: comment.content,
                  timestamp: comment.timestamp,
                  blogId: blog.id,
                  blogTitle: blog.title,
                  isReply: false
                });
              }
              
              // Check replies too
              if (comment.replies && comment.replies.length > 0) {
                for (const reply of comment.replies) {
                  if (reply.authorId === userId) {
                    userComments.push({
                      id: reply.id,
                      content: reply.content,
                      timestamp: reply.timestamp,
                      blogId: blog.id,
                      blogTitle: blog.title,
                      isReply: true,
                      parentCommentAuthor: comment.authorNickname || comment.author
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Sort by timestamp, newest first
    userComments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return new Response(JSON.stringify({ comments: userComments.slice(0, 20) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Get single blog (also increments view count)
  'GET /api/blogs/:id': async (request, env, params) => {
    const blogData = await env.BLOGS.get(`blog:${params.id}`);
    
    if (!blogData) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blog = JSON.parse(blogData);
    
    // Initialize likes/dislikes for existing blogs that don't have them
    if (typeof blog.likes !== 'number') blog.likes = 0;
    if (typeof blog.dislikes !== 'number') blog.dislikes = 0;
    if (!blog.likedBy) blog.likedBy = [];
    if (!blog.dislikedBy) blog.dislikedBy = [];
    
    // Increment view count
    blog.viewCount = (blog.viewCount || 0) + 1;
    await env.BLOGS.put(`blog:${params.id}`, JSON.stringify(blog));

    return new Response(JSON.stringify(blog), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Create new blog (admin only)
  'POST /api/blogs': async (request, env) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!user.isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { title, content, bannerImage, thumbnailImage, originalAuthor, commentsDisabled } = await request.json();
    
    const blogId = Date.now();
    const newBlog = {
      id: blogId,
      title,
      content,
      authorNickname: originalAuthor || user.nickname || user.username,
      authorId: user.id,
      authorUsername: user.username,
      authorEmail: user.publicEmail || null,
      originalAuthor: originalAuthor || null,
      publishDate: new Date().toISOString(),
      bannerImage: bannerImage || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop',
      thumbnailImage: thumbnailImage || bannerImage || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=400&fit=crop',
      commentsDisabled: commentsDisabled || false,
      viewCount: 0,
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
      comments: []
    };

    await env.BLOGS.put(`blog:${blogId}`, JSON.stringify(newBlog));

    return new Response(JSON.stringify({ success: true, blog: newBlog }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Add comment to blog
  'POST /api/blogs/:id/comments': async (request, env, params) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { content, mentions } = await request.json();
    const blogData = await env.BLOGS.get(`blog:${params.id}`);
    
    if (!blogData) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blog = JSON.parse(blogData);
    
    // Check if comments are disabled
    if (blog.commentsDisabled) {
      return new Response(JSON.stringify({ error: 'Comments are disabled for this blog post' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const newComment = {
      id: Date.now(),
      author: user.username,
      authorNickname: user.nickname || user.username,
      authorId: user.id,
      authorPhoto: user.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6b46c1&color=fff&size=128`,
      content,
      mentions: mentions || [],
      timestamp: new Date().toISOString(),
      replies: []
    };

    blog.comments.push(newComment);
    await env.BLOGS.put(`blog:${params.id}`, JSON.stringify(blog));

    // Increment user's commentsPosted stat
    if (!user.activityStats) user.activityStats = { blogsInteracted: 0, blogsSuggested: 0, commentsPosted: 0, blogsAuthored: 0 };
    user.activityStats.commentsPosted = (user.activityStats.commentsPosted || 0) + 1;
    await env.USERS.put(`user:${user.id}`, JSON.stringify(user));
    await env.USERS.put(`discord:${user.discordId}`, JSON.stringify(user));

    // TODO: If mentions exist, queue Discord DM notifications
    // This would require a Discord bot webhook or separate service

    return new Response(JSON.stringify({ success: true, comment: newComment }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Delete comment (admin only)
  'DELETE /api/blogs/:id/comments/:commentId': async (request, env, params) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!user.isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blogData = await env.BLOGS.get(`blog:${params.id}`);
    
    if (!blogData) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blog = JSON.parse(blogData);
    const commentIndex = blog.comments.findIndex(c => c.id === parseInt(params.commentId));
    
    if (commentIndex === -1) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    blog.comments.splice(commentIndex, 1);
    await env.BLOGS.put(`blog:${params.id}`, JSON.stringify(blog));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Add reply to comment (supports nested replies via parentReplyId)
  'POST /api/blogs/:id/comments/:commentId/replies': async (request, env, params) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { content, imageUrl, parentReplyId } = await request.json();
    const blogData = await env.BLOGS.get(`blog:${params.id}`);
    
    if (!blogData) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blog = JSON.parse(blogData);
    const comment = blog.comments.find(c => c.id === parseInt(params.commentId));
    
    if (!comment) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newReply = {
      id: Date.now(),
      author: user.username,
      authorNickname: user.nickname || user.username,
      authorId: user.id,
      authorPhoto: user.profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6b46c1&color=fff&size=128`,
      content,
      imageUrl: imageUrl || null,
      parentReplyId: parentReplyId || null, // For nested replies
      timestamp: new Date().toISOString(),
      replies: [] // Nested replies array
    };

    // If it's a reply to another reply, find and nest it
    if (parentReplyId) {
      const parentReply = findReplyById(comment.replies, parentReplyId);
      if (parentReply) {
        if (!parentReply.replies) parentReply.replies = [];
        parentReply.replies.push(newReply);
      } else {
        // Fallback to top-level if parent not found
        comment.replies.push(newReply);
      }
    } else {
      comment.replies.push(newReply);
    }
    
    await env.BLOGS.put(`blog:${params.id}`, JSON.stringify(blog));

    // Increment commentsPosted stat
    if (!user.activityStats) user.activityStats = { blogsInteracted: 0, blogsSuggested: 0, commentsPosted: 0, blogsAuthored: 0 };
    user.activityStats.commentsPosted = (user.activityStats.commentsPosted || 0) + 1;
    await env.USERS.put(`user:${user.id}`, JSON.stringify(user));
    await env.USERS.put(`discord:${user.discordId}`, JSON.stringify(user));

    return new Response(JSON.stringify({ success: true, reply: newReply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Delete reply (author or admin)
  'DELETE /api/blogs/:id/comments/:commentId/replies/:replyId': async (request, env, params) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blogData = await env.BLOGS.get(`blog:${params.id}`);
    if (!blogData) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blog = JSON.parse(blogData);
    const comment = blog.comments.find(c => c.id === parseInt(params.commentId));
    
    if (!comment) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find and remove the reply (including nested)
    const replyId = parseInt(params.replyId);
    const result = removeReplyById(comment.replies, replyId, user);
    
    if (!result.found) {
      return new Response(JSON.stringify({ error: 'Reply not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!result.authorized) {
      return new Response(JSON.stringify({ error: 'Not authorized to delete this reply' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await env.BLOGS.put(`blog:${params.id}`, JSON.stringify(blog));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Delete blog (admin only)
  'DELETE /api/blogs/:id': async (request, env, params) => {
    const user = await getAuthUser(request, env);
    if (!user || !user.isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await env.BLOGS.delete(`blog:${params.id}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Blog suggestions
  'POST /api/suggestions': async (request, env) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { title, description } = await request.json();
    
    const suggestionId = Date.now();
    const newSuggestion = {
      id: suggestionId,
      title,
      description,
      userId: user.id,
      username: user.username,
      userPhoto: user.profilePhoto,
      timestamp: new Date().toISOString()
    };

    await env.BLOG_SUGGESTIONS.put(`suggestion:${suggestionId}`, JSON.stringify(newSuggestion));

    return new Response(JSON.stringify({ success: true, suggestion: newSuggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Get all suggestions (admin only)
  'GET /api/suggestions': async (request, env) => {
    const user = await getAuthUser(request, env);
    if (!user || !user.isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const suggestionsList = await env.BLOG_SUGGESTIONS.list();
    const suggestions = [];
    
    for (const key of suggestionsList.keys) {
      if (key.name.startsWith('suggestion:')) {
        const suggestionData = await env.BLOG_SUGGESTIONS.get(key.name);
        if (suggestionData) {
          suggestions.push(JSON.parse(suggestionData));
        }
      }
    }
    
    // Sort by timestamp, newest first
    suggestions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Like a blog post
  'POST /api/blogs/:id/like': async (request, env, params) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blogData = await env.BLOGS.get(`blog:${params.id}`);
    if (!blogData) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blog = JSON.parse(blogData);
    
    // Initialize arrays if they don't exist (for existing blogs)
    if (!blog.likedBy) blog.likedBy = [];
    if (!blog.dislikedBy) blog.dislikedBy = [];
    if (typeof blog.likes !== 'number') blog.likes = 0;
    if (typeof blog.dislikes !== 'number') blog.dislikes = 0;

    const alreadyLiked = blog.likedBy.includes(user.id);
    const alreadyDisliked = blog.dislikedBy.includes(user.id);

    if (alreadyLiked) {
      // Remove like (toggle off)
      blog.likedBy = blog.likedBy.filter(id => id !== user.id);
      blog.likes = Math.max(0, blog.likes - 1);
    } else {
      // Add like
      blog.likedBy.push(user.id);
      blog.likes += 1;
      
      // Remove dislike if exists
      if (alreadyDisliked) {
        blog.dislikedBy = blog.dislikedBy.filter(id => id !== user.id);
        blog.dislikes = Math.max(0, blog.dislikes - 1);
      }
      
      // Increment user's blogsInteracted stat
      if (!user.activityStats) user.activityStats = { blogsInteracted: 0, blogsSuggested: 0, commentsPosted: 0, blogsAuthored: 0 };
      user.activityStats.blogsInteracted = (user.activityStats.blogsInteracted || 0) + 1;
      await env.USERS.put(`user:${user.id}`, JSON.stringify(user));
      await env.USERS.put(`discord:${user.discordId}`, JSON.stringify(user));
    }

    await env.BLOGS.put(`blog:${params.id}`, JSON.stringify(blog));

    return new Response(JSON.stringify({ 
      success: true, 
      likes: blog.likes, 
      dislikes: blog.dislikes,
      userLiked: !alreadyLiked,
      userDisliked: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Dislike a blog post
  'POST /api/blogs/:id/dislike': async (request, env, params) => {
    const user = await getAuthUser(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blogData = await env.BLOGS.get(`blog:${params.id}`);
    if (!blogData) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blog = JSON.parse(blogData);
    
    // Initialize arrays if they don't exist (for existing blogs)
    if (!blog.likedBy) blog.likedBy = [];
    if (!blog.dislikedBy) blog.dislikedBy = [];
    if (typeof blog.likes !== 'number') blog.likes = 0;
    if (typeof blog.dislikes !== 'number') blog.dislikes = 0;

    const alreadyLiked = blog.likedBy.includes(user.id);
    const alreadyDisliked = blog.dislikedBy.includes(user.id);

    if (alreadyDisliked) {
      // Remove dislike (toggle off)
      blog.dislikedBy = blog.dislikedBy.filter(id => id !== user.id);
      blog.dislikes = Math.max(0, blog.dislikes - 1);
    } else {
      // Add dislike
      blog.dislikedBy.push(user.id);
      blog.dislikes += 1;
      
      // Remove like if exists
      if (alreadyLiked) {
        blog.likedBy = blog.likedBy.filter(id => id !== user.id);
        blog.likes = Math.max(0, blog.likes - 1);
      }
      
      // Increment user's blogsInteracted stat
      if (!user.activityStats) user.activityStats = { blogsInteracted: 0, blogsSuggested: 0, commentsPosted: 0, blogsAuthored: 0 };
      user.activityStats.blogsInteracted = (user.activityStats.blogsInteracted || 0) + 1;
      await env.USERS.put(`user:${user.id}`, JSON.stringify(user));
      await env.USERS.put(`discord:${user.discordId}`, JSON.stringify(user));
    }

    await env.BLOGS.put(`blog:${params.id}`, JSON.stringify(blog));

    return new Response(JSON.stringify({ 
      success: true, 
      likes: blog.likes, 
      dislikes: blog.dislikes,
      userLiked: false,
      userDisliked: !alreadyDisliked
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },

  // Track blog view and increment user interaction
  'POST /api/blogs/:id/view': async (request, env, params) => {
    const user = await getAuthUser(request, env);
    
    const blogData = await env.BLOGS.get(`blog:${params.id}`);
    if (!blogData) {
      return new Response(JSON.stringify({ error: 'Blog not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If user is logged in, increment their blogsInteracted stat
    if (user) {
      if (!user.activityStats) user.activityStats = { blogsInteracted: 0, blogsSuggested: 0, commentsPosted: 0, blogsAuthored: 0 };
      user.activityStats.blogsInteracted = (user.activityStats.blogsInteracted || 0) + 1;
      await env.USERS.put(`user:${user.id}`, JSON.stringify(user));
      await env.USERS.put(`discord:${user.discordId}`, JSON.stringify(user));
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};

// Main request handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Find matching route
    const path = url.pathname;
    const routeKey = `${method} ${path}`;
    
    // Check for exact match
    if (routes[routeKey]) {
      try {
        return await routes[routeKey](request, env);
      } catch (error) {
        console.error('Route error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check for parameterized routes
    for (const [route, handler] of Object.entries(routes)) {
      const [routeMethod, routePath] = route.split(' ');
      if (method !== routeMethod) continue;

      const routeParts = routePath.split('/');
      const pathParts = path.split('/');

      if (routeParts.length !== pathParts.length) continue;

      const params = {};
      let matches = true;

      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          params[routeParts[i].substring(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        try {
          return await handler(request, env, params);
        } catch (error) {
          console.error('Route error:', error);
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
