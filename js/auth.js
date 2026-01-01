// Authentication Management System
class AuthManager {
  constructor() {
    this.currentUser = this.getCurrentUser();
  }

  // Get current logged-in user
  getCurrentUser() {
    const userJson = localStorage.getItem('currentUser');
    return userJson ? JSON.parse(userJson) : null;
  }

  // Check if user is logged in
  isLoggedIn() {
    return this.currentUser !== null;
  }

  // Check if current user is admin
  isAdmin() {
    return this.currentUser && this.currentUser.isAdmin === true;
  }

  // Get all users from localStorage
  getAllUsers() {
    const usersJson = localStorage.getItem('users');
    return usersJson ? JSON.parse(usersJson) : [];
  }

  // Save users to localStorage
  saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
  }

  // Register new user
  register(username, password, profilePhoto = null, bio = '', pronouns = '', nickname = '', discordData = null) {
    const users = this.getAllUsers();
    
    // Check if username already exists
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, message: 'An account is already associated with this username' };
    }

    // Check if password already exists (duplicate account attempt) - only for regular registration
    if (password && users.find(u => u.password === password)) {
      return { success: false, message: 'An account is already associated with these credentials' };
    }

    // Validate bio (max 200 chars, no links)
    if (bio) {
      if (bio.length > 200) {
        return { success: false, message: 'Bio must be 200 characters or less' };
      }
      // Check for links in bio
      const urlPattern = /(https?:\/\/|www\.)/i;
      if (urlPattern.test(bio)) {
        return { success: false, message: 'Links are not allowed in bio' };
      }
    }

    // Create new user
    const newUser = {
      id: Date.now(),
      username: username,
      nickname: nickname || username,
      password: password || null, // No password for Discord users
      profilePhoto: profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6b46c1&color=fff&size=128`,
      pronouns: pronouns || '',
      bio: bio || '',
      followers: [],
      following: [],
      createdAt: new Date().toISOString(),
      isAdmin: false,
      suspended: false,
      discordId: discordData ? discordData.id : null,
      discordConnected: !!discordData,
      activityStats: {
        blogsInteracted: 0,
        blogsSuggested: 0,
        commentsPosted: 0,
        blogsAuthored: 0
      }
    };

    users.push(newUser);
    this.saveUsers(users);

    return { success: true, user: newUser };
  }

  // Initialize admin users
  initializeAdminUsers() {
    const users = this.getAllUsers();
    const adminProfiles = [
      {
        username: 'teejayeveril',
        nickname: 'Teejay Everil',
        password: 'admin2025',
        profilePhoto: 'https://ui-avatars.com/api/?name=Teejay+Everil&background=6b46c1&color=fff&size=128',
        pronouns: 'he/him',
        bio: 'Administrator and content creator at Cirkle Development Group.',
        isAdmin: true
      },
      {
        username: 'sam',
        nickname: 'Sam',
        password: 'admin2025',
        profilePhoto: 'https://ui-avatars.com/api/?name=Sam&background=553c9a&color=fff&size=128',
        pronouns: 'he/him',
        bio: 'Administrator and content creator at Cirkle Development Group.',
        isAdmin: true
      },
      {
        username: 'caster',
        nickname: 'Caster',
        password: 'admin2025',
        profilePhoto: 'https://ui-avatars.com/api/?name=Caster&background=7c3aed&color=fff&size=128',
        pronouns: 'he/him',
        bio: 'Administrator and content creator at Cirkle Development Group.',
        isAdmin: true
      },
      {
        username: 'marcusray',
        nickname: 'Marcus Ray',
        password: 'admin2025',
        profilePhoto: 'https://ui-avatars.com/api/?name=Marcus+Ray&background=6b46c1&color=fff&size=128',
        pronouns: 'he/him',
        bio: 'Board of Directors at Cirkle Development Group. Backend development specialist.',
        isAdmin: true
      },
      {
        username: 'applersmith',
        nickname: 'Appler Smith',
        password: 'admin2025',
        profilePhoto: 'https://ui-avatars.com/api/?name=Appler+Smith&background=8b5cf6&color=fff&size=128',
        pronouns: 'they/them',
        bio: 'Administrator and content creator at Cirkle Development Group.',
        isAdmin: true
      }
    ];

    adminProfiles.forEach(adminData => {
      // Check if admin already exists
      const existingAdmin = users.find(u => u.username.toLowerCase() === adminData.username.toLowerCase());
      if (!existingAdmin) {
        const adminUser = {
          id: Date.now() + Math.random(),
          username: adminData.username,
          nickname: adminData.nickname,
          password: adminData.password,
          profilePhoto: adminData.profilePhoto,
          pronouns: adminData.pronouns,
          bio: adminData.bio,
          followers: [],
          following: [],
          createdAt: new Date().toISOString(),
          isAdmin: adminData.isAdmin,
          suspended: false,
          discordId: null,
          discordConnected: false,
          activityStats: {
            blogsInteracted: 0,
            blogsSuggested: 0,
            commentsPosted: 0,
            blogsAuthored: 0
          }
        };
        users.push(adminUser);
      }
    });

    this.saveUsers(users);
  }

  // Increment activity stat
  incrementActivityStat(userId, statName) {
    const users = this.getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) return;

    if (!users[userIndex].activityStats) {
      users[userIndex].activityStats = {
        blogsInteracted: 0,
        blogsSuggested: 0,
        commentsPosted: 0,
        blogsAuthored: 0
      };
    }

    if (users[userIndex].activityStats[statName] !== undefined) {
      users[userIndex].activityStats[statName]++;
      this.saveUsers(users);

      // Update current user if it's the same
      if (this.currentUser && this.currentUser.id === userId) {
        this.currentUser = users[userIndex];
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      }
    }
  }

  // Login user
  login(username, password) {
    // Check for admin credentials
    if (username === 'ADMIN' && password === '11122025cirkle') {
      const adminUser = {
        id: 0,
        username: 'ADMIN',
        profilePhoto: 'https://ui-avatars.com/api/?name=Admin&background=dc2626&color=fff&size=128',
        isAdmin: true,
        suspended: false
      };
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      this.currentUser = adminUser;
      return { success: true, user: adminUser };
    }

    const users = this.getAllUsers();
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
      return { success: false, message: 'Invalid username or password' };
    }

    if (user.suspended) {
      return { success: false, message: 'Your account has been suspended' };
    }

    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUser = user;
    return { success: true, user: user };
  }

  // Logout user
  logout() {
    localStorage.removeItem('currentUser');
    this.currentUser = null;
    window.location.href = '/';
  }

  // Update user profile
  updateProfile(userId, updates) {
    const users = this.getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: 'User not found' };
    }

    users[userIndex] = { ...users[userIndex], ...updates };
    this.saveUsers(users);

    // Update current user if it's the same
    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser = users[userIndex];
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    }

    return { success: true, user: users[userIndex] };
  }

  // Suspend user (admin only)
  suspendUser(userId) {
    if (!this.isAdmin()) {
      return { success: false, message: 'Unauthorized' };
    }

    return this.updateProfile(userId, { suspended: true });
  }

  // Unsuspend user (admin only)
  unsuspendUser(userId) {
    if (!this.isAdmin()) {
      return { success: false, message: 'Unauthorized' };
    }

    return this.updateProfile(userId, { suspended: false });
  }

  // Delete user (admin only)
  deleteUser(userId) {
    if (!this.isAdmin()) {
      return { success: false, message: 'Unauthorized' };
    }

    const users = this.getAllUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    this.saveUsers(filteredUsers);

    return { success: true };
  }

  // Get time-based greeting
  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  // Follow/unfollow user
  followUser(targetUserId) {
    if (!this.currentUser || this.currentUser.id === targetUserId) {
      return { success: false, message: 'Cannot follow yourself' };
    }

    const users = this.getUsers();
    const currentUserIndex = users.findIndex(u => u.id === this.currentUser.id);
    const targetUserIndex = users.findIndex(u => u.id === targetUserId);

    if (currentUserIndex === -1 || targetUserIndex === -1) {
      return { success: false, message: 'User not found' };
    }

    if (!users[currentUserIndex].following) users[currentUserIndex].following = [];
    if (!users[targetUserIndex].followers) users[targetUserIndex].followers = [];

    const isFollowing = users[currentUserIndex].following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      users[currentUserIndex].following = users[currentUserIndex].following.filter(id => id !== targetUserId);
      users[targetUserIndex].followers = users[targetUserIndex].followers.filter(id => id !== this.currentUser.id);
    } else {
      // Follow
      users[currentUserIndex].following.push(targetUserId);
      users[targetUserIndex].followers.push(this.currentUser.id);
    }

    this.saveUsers(users);
    this.currentUser = users[currentUserIndex];
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

    return { success: true, isFollowing: !isFollowing };
  }

  // Get user by ID
  getUserById(userId) {
    const users = this.getUsers();
    return users.find(u => u.id === userId);
  }
}

// Blog Management System
class BlogManager {
  constructor() {
    this.initializeSampleBlogs();
  }

  // Initialize with sample blogs if none exist
  initializeSampleBlogs() {
    const blogs = this.getAllBlogs();
    if (blogs.length === 0) {
      const sampleBlogs = [
        {
          id: 1,
          title: 'Welcome to Cirkle Development Group',
          content: '<p>We are thrilled to announce the launch of our new blog! This platform will serve as a hub for updates, insights, and stories from the Cirkle Development Group and our subsidiaries.</p><p>Stay tuned for exciting content about our projects, company updates, and industry insights.</p>',
          author: 'Marcus Ray',
          authorId: null,
          authorUsername: 'marcusray',
          authorEmail: 'marcusray@cirkledevelopment.co.uk',
          publishDate: new Date().toISOString(),
          bannerImage: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop',
          thumbnailImage: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=400&fit=crop',
          comments: []
        },
        {
          id: 2,
          title: 'Introducing Our Subsidiaries',
          content: '<p>Cirkle Development Group is proud to be the parent organization of several innovative companies, including Cirkle Development, Aer Lingus PTFS, and DevDen.</p><p>Each subsidiary focuses on delivering excellence in their respective domains, and together we form a powerful network of expertise and innovation.</p>',
          author: 'Sam Caster',
          authorId: null,
          authorUsername: 'sam',
          authorEmail: 'samcaster@cirkledevelopment.co.uk',
          publishDate: new Date(Date.now() - 86400000).toISOString(),
          bannerImage: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=400&fit=crop',
          thumbnailImage: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop',
          comments: []
        }
      ];
      this.saveBlogs(sampleBlogs);
    }
  }

  // Get all blogs
  getAllBlogs() {
    const blogsJson = localStorage.getItem('blogs');
    return blogsJson ? JSON.parse(blogsJson) : [];
  }

  // Save blogs to localStorage
  saveBlogs(blogs) {
    localStorage.setItem('blogs', JSON.stringify(blogs));
  }

  // Get single blog by ID
  getBlogById(id) {
    const blogs = this.getAllBlogs();
    return blogs.find(b => b.id === parseInt(id));
  }

  // Create new blog (admin only)
  createBlog(blogData, author) {
    const blogs = this.getAllBlogs();
    
    const newBlog = {
      id: Date.now(),
      title: blogData.title,
      content: blogData.content,
      authorNickname: author.nickname || author.username,
      authorId: author.id,
      authorUsername: author.username,
      authorEmail: author.email || 'info@cirkledevelopment.co.uk',
      publishDate: new Date().toISOString(),
      bannerImage: blogData.bannerImage || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop',
      thumbnailImage: blogData.thumbnailImage || blogData.bannerImage || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=400&fit=crop',
      comments: []
    };

    blogs.unshift(newBlog);
    this.saveBlogs(blogs);

    // Increment author's blog count
    if (auth && author.id) {
      auth.incrementActivityStat(author.id, 'blogsAuthored');
    }
    
    return { success: true, blog: newBlog };
  }

  // Add comment to blog
  addComment(blogId, comment, user) {
    const blogs = this.getAllBlogs();
    const blogIndex = blogs.findIndex(b => b.id === parseInt(blogId));
    
    if (blogIndex === -1) {
      return { success: false, message: 'Blog not found' };
    }

    const newComment = {
      id: Date.now(),
      author: user.username,
      authorNickname: user.nickname || user.username,
      authorId: user.id,
      authorPhoto: user.profilePhoto,
      content: comment,
      timestamp: new Date().toISOString(),
      replies: []
    };

    blogs[blogIndex].comments.push(newComment);
    this.saveBlogs(blogs);

    // Increment user's comment count and interaction count
    if (auth) {
      auth.incrementActivityStat(user.id, 'commentsPosted');
      auth.incrementActivityStat(user.id, 'blogsInteracted');
    }

    return { success: true, comment: newComment };
  }

  // Add reply to comment
  addReply(blogId, commentId, replyText, user) {
    const blogs = this.getAllBlogs();
    const blogIndex = blogs.findIndex(b => b.id === parseInt(blogId));
    
    if (blogIndex === -1) {
      return { success: false, message: 'Blog not found' };
    }

    const commentIndex = blogs[blogIndex].comments.findIndex(c => c.id === parseInt(commentId));
    if (commentIndex === -1) {
      return { success: false, message: 'Comment not found' };
    }

    if (!blogs[blogIndex].comments[commentIndex].replies) {
      blogs[blogIndex].comments[commentIndex].replies = [];
    }

    const newReply = {
      id: Date.now(),
      author: user.username,
      authorNickname: user.nickname || user.username,
      authorId: user.id,
      authorPhoto: user.profilePhoto,
      content: replyText,
      timestamp: new Date().toISOString()
    };

    blogs[blogIndex].comments[commentIndex].replies.push(newReply);
    this.saveBlogs(blogs);

    // Increment user's comment count and interaction count
    if (auth) {
      auth.incrementActivityStat(user.id, 'commentsPosted');
      auth.incrementActivityStat(user.id, 'blogsInteracted');
    }

    return { success: true, reply: newReply };
  }

  // Get all comments by user
  getUserComments(userId) {
    const blogs = this.getAllBlogs();
    const userComments = [];

    blogs.forEach(blog => {
      blog.comments.forEach(comment => {
        if (comment.authorId === userId) {
          userComments.push({
            ...comment,
            blogTitle: blog.title,
            blogId: blog.id
          });
        }
        // Check replies too
        if (comment.replies) {
          comment.replies.forEach(reply => {
            if (reply.authorId === userId) {
              userComments.push({
                ...reply,
                blogTitle: blog.title,
                blogId: blog.id,
                isReply: true,
                parentCommentAuthor: comment.author
              });
            }
          });
        }
      });
    });

    return userComments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // Delete blog (admin nickname || user.username,
      suggestedById: user.id,
      suggestedAt: new Date().toISOString(),
      status: 'pending'
    };

    suggestions.push(newSuggestion);
    localStorage.setItem('blogSuggestions', JSON.stringify(suggestions));

    // Increment user's suggestion count
    if (auth) {
      auth.incrementActivityStat(user.id, 'blogsSuggested');
    }
  }

  // Get blog suggestions
  getAllSuggestions() {
    const suggestionsJson = localStorage.getItem('blogSuggestions');
    return suggestionsJson ? JSON.parse(suggestionsJson) : [];
  }

  // Save blog suggestion
  saveSuggestion(title, content, user) {
    const suggestions = this.getAllSuggestions();
    
    const newSuggestion = {
      id: Date.now(),
      title: title,
      content: content,
      suggestedBy: user.username,
      suggestedAt: new Date().toISOString(),
      status: 'pending'
    };

    suggestions.push(newSuggestion);
    localStorage.setItem('blogSuggestions', JSON.stringify(suggestions));

    return { success: true, suggestion: newSuggestion };
  }
}

// Initialize global instances
const auth = new AuthManager();
const blogManager = new BlogManager();

// Initialize admin users on first load
auth.initializeAdminUsers();

// Update header based on login status
function updateHeader() {
  const staffLoginBtn = document.querySelector('.staff-login');
  let userProfileBtn = document.querySelector('.user-profile');

  if (auth.isLoggedIn()) {
    // User is logged in, show profile
    if (staffLoginBtn) staffLoginBtn.style.display = 'none';
    
    // Remove existing profile button if any
    if (userProfileBtn) userProfileBtn.remove();
    
    // Create new profile button
    const profileHTML = `
      <div class="user-profile">
        <img src="${auth.currentUser.profilePhoto}" alt="${auth.currentUser.username}" class="profile-photo" id="profile-trigger">
        <div class="profile-dropdown" id="profile-dropdown">
          <div class="profile-dropdown-header">
            <img src="${auth.currentUser.profilePhoto}" alt="${auth.currentUser.username}" class="profile-dropdown-avatar">
            <div>
              <div class="profile-dropdown-name">${auth.currentUser.nickname || auth.currentUser.username}</div>
              <div class="profile-dropdown-username">@${auth.currentUser.username}</div>
            </div>
          </div>
          <div class="profile-dropdown-divider"></div>
          <a href="${auth.isAdmin() ? '/admin/dashboard.html' : '/consumer/dashboard.html'}" class="profile-dropdown-item">
            <span class="profile-dropdown-icon">📊</span>
            ${auth.isAdmin() ? 'Admin Dashboard' : 'Dashboard'}
          </a>
          <a href="#" onclick="auth.logout(); return false;" class="profile-dropdown-item">
            <span class="profile-dropdown-icon">🚪</span>
            Logout
          </a>
        </div>
      </div>
    `;
    staffLoginBtn.insertAdjacentHTML('afterend', profileHTML);
    
    // Add click event to toggle dropdown
    setTimeout(() => {
      const profileTrigger = document.getElementById('profile-trigger');
      const dropdown = document.getElementById('profile-dropdown');
      
      if (profileTrigger && dropdown) {
        profileTrigger.addEventListener('click', function(e) {
          e.stopPropagation();
          dropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
          if (!e.target.closest('.user-profile')) {
            dropdown.classList.remove('show');
          }
        });
      }
    }, 100);
  } else {
    // User not logged in, show login button
    if (userProfileBtn) userProfileBtn.remove();
    if (staffLoginBtn) staffLoginBtn.style.display = 'block';
  }
}

// Run on page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', updateHeader);
}
