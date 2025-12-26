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
function loadBlogs() {
  const blogs = blogManager.getAllBlogs();
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

    blogCard.innerHTML = `
      <div class="blog-card-image" style="background-image: url('${blog.thumbnailImage}');">
        <div class="blog-card-overlay">
          <h2>${blog.title}</h2>
        </div>
      </div>
      <div class="blog-card-content">
        <div class="blog-meta">
          <span class="blog-author">By ${blog.author}</span>
          <span class="blog-date">${formattedDate}</span>
        </div>
        <div class="blog-comments">
          💬 ${blog.comments.length} ${blog.comments.length === 1 ? 'comment' : 'comments'}
        </div>
      </div>
    `;

    blogGrid.appendChild(blogCard);
  });
}

// Load blog post
function loadBlogPost(blogId) {
  if (!blogId) {
    showBlogNotFound();
    return;
  }

  const blog = blogManager.getBlogById(blogId);
  
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

  const authorInitial = blog.author.charAt(0).toUpperCase();

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
            <div class="author-name">${blog.author}</div>
            <div class="author-email">${blog.authorEmail}</div>
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

      <div id="comment-form-container">
        ${auth.isLoggedIn() ? `
          <div class="comment-form">
            <textarea id="comment-text" placeholder="Share your thoughts..."></textarea>
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

      <div class="comments-list" id="comments-list">
        ${blog.comments.length > 0 ? renderComments(blog.comments) : '<p style="text-align: center; color: #718096; padding: 20px;">No comments yet. Be the first to comment!</p>'}
      </div>
    </div>
  `;
}

function renderComments(comments) {
  return comments.map(comment => {
    const commentDate = new Date(comment.timestamp);
    const timeAgo = getTimeAgo(commentDate);
    const replies = comment.replies || [];

    return `
      <div class="comment">
        <div class="comment-header">
          <img src="${comment.authorPhoto}" alt="${comment.author}" class="comment-avatar" style="cursor: pointer;" onclick="openUserProfile(${comment.authorId})">
          <span class="comment-author" style="cursor: pointer;" onclick="openUserProfile(${comment.authorId})">${comment.author}</span>
          <span class="comment-time">${timeAgo}</span>
        </div>
        <div class="comment-content">${comment.content}</div>
        ${auth.isLoggedIn() ? `
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
                    <span class="comment-author" style="cursor: pointer;" onclick="openUserProfile(${reply.authorId})">${reply.author}</span>
                    <span class="comment-time">${replyTimeAgo}</span>
                  </div>
                  <div class="comment-content">${reply.content}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
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

  const result = blogManager.addReply(currentBlogId, commentId, replyText.value, auth.currentUser);

  if (result.success) {
    messageDiv.textContent = 'Reply posted!';
    messageDiv.className = 'success-message';
    
    setTimeout(() => {
      loadBlogPost(currentBlogId);
    }, 500);
  } else {
    messageDiv.textContent = result.message;
    messageDiv.className = 'error-message';
  }
}

function openUserProfile(userId) {
  window.location.href = `consumer/dashboard.html?viewProfile=${userId}`;
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

function submitComment() {
  const commentText = document.getElementById('comment-text');
  const messageDiv = document.getElementById('comment-message');
  
  if (!commentText.value.trim()) {
    messageDiv.textContent = 'Please write a comment';
    messageDiv.className = 'error-message';
    return;
  }

  const result = blogManager.addComment(currentBlogId, commentText.value, auth.currentUser);

  if (result.success) {
    messageDiv.textContent = 'Comment posted successfully!';
    messageDiv.className = 'success-message';
    commentText.value = '';

    // Reload blog to show new comment
    setTimeout(() => {
      loadBlogPost(currentBlogId);
    }, 1000);
  } else {
    messageDiv.textContent = result.message;
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