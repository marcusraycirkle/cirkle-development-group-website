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

// Helper to get authenticated user from request
async function getAuthUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const sessionData = await env.SESSIONS.get(token);
  
  if (!sessionData) {
    return null;
  }
  
  const session = JSON.parse(sessionData);
  if (session.expiresAt < Date.now()) {
    await env.SESSIONS.delete(token);
    return null;
  }
  
  const userData = await env.USERS.get(`user:${session.userId}`);
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

    return new Response(JSON.stringify({
      sessionId: sessionId,
      user: user,
      isNewUser: !existingUserData,
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
    const allowedFields = ['nickname', 'pronouns', 'bio', 'profilePhoto'];
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
