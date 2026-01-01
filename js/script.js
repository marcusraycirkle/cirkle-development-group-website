let slideIndex = 0;
let currentBlogId = null; // Track current blog post ID

function showSlides() {
  // Only run slideshow logic on the home page
  const homePage = document.getElementById('home');
  if (!homePage || !homePage.classList.contains('active')) return;
  let slides = homePage.getElementsByClassName("slide");
  for (let i = 0; i < slides.length; i++) {
    slides[i].classList.remove("active");
  }
  slideIndex++;
  if (slideIndex > slides.length) { slideIndex = 1; }
  slides[slideIndex - 1].classList.add("active");
  setTimeout(showSlides, 4000); // 4-second interval
}

function plusSlides(n) {
  const homePage = document.getElementById('home');
  if (!homePage || !homePage.classList.contains('active')) return;
  let slides = homePage.getElementsByClassName("slide");
  slideIndex += n;
  if (slideIndex > slides.length) { slideIndex = 1; }
  if (slideIndex < 1) { slideIndex = slides.length; }
  for (let i = 0; i < slides.length; i++) {
    slides[i].classList.remove("active");
  }
  slides[slideIndex - 1].classList.add("active");
}

function showPage(pageId) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(page => {
    page.classList.remove('active');
  });
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  
  // Load blog content if navigating to blog page
  if (pageId === 'blog') {
    loadBlogs();
  }
}

// Load and display blogs
async function loadBlogs() {
  try {
    const blogs = await api.getAllBlogs();
    const blogGrid = document.getElementById('blog-grid');
    const noBlogs = document.getElementById('no-blogs');

    if (blogs.length === 0) {
      blogGrid.style.display = 'none';
      noBlogs.style.display = 'block';
      return;
    }

    blogGrid.style.display = 'flex';
    noBlogs.style.display = 'none';
    blogGrid.innerHTML = '';
    
    blogs.forEach(blog => {
      const blogCard = document.createElement('div');
      blogCard.className = 'blog-card';
      blogCard.onclick = () => {
        currentBlogId = blog.id;
        window.location.hash = `blog-post?id=${blog.id}`;
      };
      
      const date = new Date(blog.publishDate);
      const formattedDate = date.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });

      // Create excerpt (first 150 characters)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = blog.content;
      const excerpt = (tempDiv.textContent || tempDiv.innerText || '').substring(0, 150) + '...';

      blogCard.innerHTML = `
        <img class="blog-card-image" src="${blog.thumbnailImage}" alt="${blog.title}" onerror="this.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22220%22%3E%3Crect fill=%22%23667eea%22 width=%22400%22 height=%22220%22/%3E%3C/svg%3E'">
        <div class="blog-card-content">
          <h3 class="blog-card-title">${blog.title}</h3>
          <p class="blog-card-excerpt">${excerpt}</p>
          <div class="blog-card-meta">
            <div>
              <span class="blog-author" onclick="event.stopPropagation();">By ${blog.authorNickname || blog.authorUsername}</span>
              <span class="blog-date"> • ${formattedDate}</span>
            </div>
            <span class="blog-comments">💬 ${blog.comments.length}</span>
          </div>
        </div>
      `;

      blogGrid.appendChild(blogCard);
    });
  } catch (error) {
    console.error('Error loading blogs:', error);
    const blogGrid = document.getElementById('blog-grid');
    const noBlogs = document.getElementById('no-blogs');
    blogGrid.style.display = 'none';
    noBlogs.style.display = 'block';
    noBlogs.textContent = 'Failed to load blogs. Please try again later.';
  }
}

// Load blog post
async function loadBlogPost(blogId) {
  if (!blogId) {
    showBlogNotFound();
    return;
  }

  // Check current user for admin features
  await checkCurrentUser();

  try {
    const blog = await api.getBlogById(blogId);
  
  if (!blog) {
    showBlogNotFound();
    return;
  }

  // Update page title
  document.title = `${blog.title} - Cirkle Development Group`;

  const date = new Date(blog.publishDate);
  const formattedDate = date.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  const authorName = blog.authorNickname || blog.authorUsername || blog.author || 'Anonymous';
  const authorInitial = authorName.charAt(0).toUpperCase();
  
  const blogContent = document.getElementById('blog-content');
  blogContent.style.display = 'block';
  document.getElementById('blog-not-found').style.display = 'none';
  
  blogContent.innerHTML = `
    <div class="blog-post-banner" style="background-image: url('${blog.bannerImage}');"></div>
    
    <div class="blog-post-header">
      <h1 class="blog-post-title">${blog.title}</h1>
      <div class="blog-post-meta">
        <div class="blog-post-author">
          <div class="author-avatar">${authorInitial}</div>
          <div class="author-info">
            <div class="author-name">${authorName}</div>
            <div class="author-email">${blog.authorEmail || 'info@cirkledevelopment.co.uk'}</div>
          </div>
        </div>
        <div class="blog-post-date">${formattedDate}</div>
      </div>
    </div>

    <div class="blog-post-content">
      ${blog.content}
    </div>

    <div class="comments-section">
      <div class="comments-header">
        <h2>Comments (${blog.comments.length})</h2>
      </div>

      ${blog.commentsDisabled ? `
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; text-align: center; color: #856404;">
          <strong>💬 Comments are disabled for this post</strong>
        </div>
      ` : `
        <div id="comment-form-container">
          ${api.isLoggedIn() ? `
            <div class="comment-form">
              <textarea id="comment-text" placeholder="Share your thoughts... Type @ to mention someone" oninput="handleCommentInput(event)"></textarea>
              <div id="mention-dropdown" style="display: none; position: absolute; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-height: 150px; overflow-y: auto; z-index: 100;"></div>
              <button class="comment-submit" onclick="submitComment()">Post Comment</button>
              <div id="comment-message" class="success-message" style="margin-top: 15px;"></div>
            </div>
          ` : `
            <div class="login-prompt">
              <p>Please log in to leave a comment</p>
              <a href="consumer/login.html" class="login-link">Login / Sign Up</a>
            </div>
          `}
        </div>
      `}

      <div class="comments-list" id="comments-list">
        ${blog.comments.length > 0 ? renderComments(blog.comments, blog.id) : '<p style="text-align: center; color: #718096; padding: 20px;">No comments yet. Be the first to comment!</p>'}
      </div>
    </div>
  `;
  } catch (error) {
    console.error('Error loading blog post:', error);
    showBlogNotFound();
  }
}

// Store current user info for admin check
let currentUserInfo = null;

async function checkCurrentUser() {
  try {
    if (api.isLoggedIn()) {
      currentUserInfo = await api.getCurrentUser();
    }
  } catch (e) {
    currentUserInfo = null;
  }
}

function renderComments(comments, blogId) {
  return comments.map(comment => {
    const commentDate = new Date(comment.timestamp);
    const timeAgo = getTimeAgo(commentDate);
    const replies = comment.replies || [];
    const isAdmin = currentUserInfo && currentUserInfo.isAdmin;

    return `
      <div class="comment" id="comment-${comment.id}">
        <div class="comment-header">
          <img src="${comment.authorPhoto}" alt="${comment.author}" class="comment-avatar" style="cursor: pointer;" onclick="openUserProfile(${comment.authorId})">
          <span class="comment-author" style="cursor: pointer;" onclick="openUserProfile(${comment.authorId})">${comment.authorNickname || comment.author}</span>
          <span class="comment-time">${timeAgo}</span>
          ${isAdmin ? `
            <button onclick="deleteComment(${blogId}, ${comment.id})" style="margin-left: auto; background: #e53e3e; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️ Delete</button>
          ` : ''}
        </div>
        <div class="comment-content">${formatMentions(comment.content)}</div>
        ${api.isLoggedIn() ? `
          <button onclick="showReplyForm(${comment.id})" class="reply-btn" style="background: none; border: none; color: #6b46c1; cursor: pointer; font-size: 13px; margin-top: 8px;">Reply</button>
          <div id="reply-form-${comment.id}" style="display: none; margin-top: 10px;">
            <textarea id="reply-text-${comment.id}" placeholder="Write a reply..." style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; resize: vertical; min-height: 60px;"></textarea>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
              <button onclick="submitReply(${comment.id})" class="comment-submit" style="padding: 8px 16px; font-size: 14px;">Post Reply</button>
              <button onclick="hideReplyForm(${comment.id})" style="padding: 8px 16px; font-size: 14px; background: #e2e8f0; color: #4a5568; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
            </div>
            <div id="reply-message-${comment.id}" class="success-message" style="margin-top: 8px;"></div>
          </div>
        ` : ''}
        ${replies.length > 0 ? `
          <div class="replies" style="margin-left: 40px; margin-top: 15px; padding-left: 15px; border-left: 2px solid #e2e8f0;">
            ${replies.map(reply => {
              const replyDate = new Date(reply.timestamp);
              const replyTimeAgo = getTimeAgo(replyDate);
              return `
                <div class="comment" style="margin-bottom: 10px;">
                  <div class="comment-header">
                    <img src="${reply.authorPhoto}" alt="${reply.author}" class="comment-avatar" style="width: 30px; height: 30px; cursor: pointer;" onclick="openUserProfile(${reply.authorId})">
                    <span class="comment-author" style="cursor: pointer;" onclick="openUserProfile(${reply.authorId})">${reply.authorNickname || reply.author}</span>
                    <span class="comment-time">${replyTimeAgo}</span>
                  </div>
                  <div class="comment-content">${formatMentions(reply.content)}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Format @mentions in content
function formatMentions(content) {
  return content.replace(/@(\w+)/g, '<span style="color: #6b46c1; font-weight: 600;">@$1</span>');
}

// Handle @ mention input
function handleCommentInput(event) {
  const textarea = event.target;
  const value = textarea.value;
  const cursorPos = textarea.selectionStart;
  
  // Find if we're typing after an @
  const textBeforeCursor = value.substring(0, cursorPos);
  const atMatch = textBeforeCursor.match(/@(\w*)$/);
  
  const dropdown = document.getElementById('mention-dropdown');
  
  if (atMatch) {
    // Show dropdown with user suggestions
    // For now, we'll show a message that this feature is coming
    dropdown.innerHTML = '<div style="padding: 10px; color: #718096; font-size: 13px;">@ mention feature - DM notifications coming soon!</div>';
    dropdown.style.display = 'block';
    
    // Position dropdown near textarea
    const rect = textarea.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 5) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = '200px';
  } else {
    dropdown.style.display = 'none';
  }
}

// Delete comment (admin only)
async function deleteComment(blogId, commentId) {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  
  try {
    await api.deleteComment(blogId, commentId);
    
    // Remove comment from DOM
    const commentElement = document.getElementById(`comment-${commentId}`);
    if (commentElement) {
      commentElement.remove();
    }
    
    // Update comment count
    loadBlogPost(blogId);
  } catch (error) {
    alert('Failed to delete comment: ' + (error.message || 'Unknown error'));
  }
}

function showReplyForm(commentId) {
  document.getElementById(`reply-form-${commentId}`).style.display = 'block';
}

function hideReplyForm(commentId) {
  document.getElementById(`reply-form-${commentId}`).style.display = 'none';
  document.getElementById(`reply-text-${commentId}`).value = '';
}

function submitReply(commentId) {
  const replyText = document.getElementById(`reply-text-${commentId}`);
  const messageDiv = document.getElementById(`reply-message-${commentId}`);
  
  if (!replyText.value.trim()) {
    messageDiv.textContent = 'Please write a reply';
    messageDiv.className = 'error-message';
    return;
  }

  // TODO: Convert to API call
  alert('Reply functionality coming soon with API integration!');
}

function openUserProfile(userId) {
  if (api.isLoggedIn()) {
    window.location.href = `consumer/dashboard.html?viewProfile=${userId}`;
  } else {
    // Show login prompt
    alert('Please log in to view user profiles');
    window.location.href = 'consumer/login.html';
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  
  return date.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
}

async function submitComment() {
  const commentText = document.getElementById('comment-text');
  const messageDiv = document.getElementById('comment-message');
  
  if (!commentText.value.trim()) {
    messageDiv.textContent = 'Please write a comment';
    messageDiv.className = 'error-message';
    return;
  }

  try {
    const result = await api.addComment(currentBlogId, commentText.value);

    messageDiv.textContent = 'Comment posted successfully!';
    messageDiv.className = 'success-message';
    commentText.value = '';

    // Reload blog to show new comment
    setTimeout(() => {
      loadBlogPost(currentBlogId);
    }, 1000);
  } catch (error) {
    messageDiv.textContent = error.message || 'Failed to post comment';
    messageDiv.className = 'error-message';
  }
}

function showBlogNotFound() {
  document.getElementById('blog-content').style.display = 'none';
  document.getElementById('blog-not-found').style.display = 'block';
}

// Handle hash changes
function handleHashChange() {
  let hash = window.location.hash.substring(1); // Remove the # symbol
  
  if (!hash || hash === '') {
    hash = 'home'; // Default to home page
  }
  
  // Check if it's a blog post (format: blog-post?id=xxx)
  if (hash.startsWith('blog-post')) {
    const urlParams = new URLSearchParams(hash.split('?')[1]);
    const blogId = urlParams.get('id');
    currentBlogId = blogId;
    showPage('blog-post');
    loadBlogPost(blogId);
  } else {
    showPage(hash);
  }
}

// Initialize slideshow when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Handle initial hash or show home
  handleHashChange();
  
  // Start slideshow
  showSlides();
  
  // Listen for hash changes
  window.addEventListener('hashchange', handleHashChange);
});