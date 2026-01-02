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
      const formattedTime = date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
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
              <span class="blog-date"> • ${formattedDate} at ${formattedTime}</span>
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
              <span class="blog-likes" style="color: #38a169;">👍 ${blog.likes || 0}</span>
              <span class="blog-dislikes" style="color: #e53e3e;">👎 ${blog.dislikes || 0}</span>
              <span class="blog-views" style="color: #718096;">👁️ ${blog.viewCount || 0}</span>
              <span class="blog-comments">💬 ${blog.comments.length}</span>
            </div>
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

  // Track view and increment user interaction if logged in
  if (api.isLoggedIn()) {
    try {
      await fetch(`https://cirkle-api.marcusray.workers.dev/api/blogs/${blogId}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (e) {
      console.log('Could not track view');
    }
  }

  // Ensure comments array exists
  blog.comments = blog.comments || [];

  // Initialize likes/dislikes for existing blogs
  blog.likes = blog.likes || 0;
  blog.dislikes = blog.dislikes || 0;
  blog.likedBy = blog.likedBy || [];
  blog.dislikedBy = blog.dislikedBy || [];

  // Update page title
  document.title = `${blog.title} - Cirkle Development Group`;

  const date = new Date(blog.publishDate);
  const formattedDate = date.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  const formattedTime = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const authorName = blog.authorNickname || blog.authorUsername || blog.author || 'Anonymous';
  const authorInitial = authorName.charAt(0).toUpperCase();
  
  const blogContent = document.getElementById('blog-content');
  blogContent.style.display = 'block';
  document.getElementById('blog-not-found').style.display = 'none';
  
  // Check if current user is admin to show delete button
  const isAdmin = currentUserInfo && currentUserInfo.isAdmin;
  const deleteButton = isAdmin ? `
    <button onclick="deleteBlogPost(${blog.id})" style="background: #e53e3e; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
      🗑️ Delete Post
    </button>
  ` : '';

  // Determine if user has liked/disliked
  const userLiked = currentUserInfo && blog.likedBy.includes(currentUserInfo.id);
  const userDisliked = currentUserInfo && blog.dislikedBy.includes(currentUserInfo.id);

  blogContent.innerHTML = `
    <div class="blog-post-banner" style="background-image: url('${blog.bannerImage}');"></div>
    
    <div class="blog-post-header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
        <h1 class="blog-post-title" style="flex: 1;">${blog.title}</h1>
        ${deleteButton}
      </div>
      <div class="blog-post-meta">
        <div class="blog-post-author">
          <div class="author-avatar">${authorInitial}</div>
          <div class="author-info">
            <div class="author-name">${authorName}</div>
            ${blog.authorEmail ? `<div class="author-email">${blog.authorEmail}</div>` : ''}
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
          <div class="blog-post-date">${formattedDate} at ${formattedTime}</div>
          <div style="color: #718096; font-size: 14px;">👁️ ${blog.viewCount || 0} views</div>
        </div>
      </div>
    </div>

    <div class="blog-post-content">
      ${blog.content}
    </div>

    <!-- Like/Dislike Reactions (at bottom of post) -->
    <div class="blog-reactions" style="display: flex; gap: 15px; padding: 20px 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin: 20px 0;">
      <button onclick="likeBlog(${blog.id})" id="like-btn" class="reaction-btn ${userLiked ? 'active' : ''}" style="display: flex; align-items: center; gap: 8px; padding: 10px 20px; border: 2px solid ${userLiked ? '#38a169' : '#e2e8f0'}; border-radius: 25px; background: ${userLiked ? '#f0fff4' : 'white'}; cursor: pointer; font-size: 16px; transition: all 0.2s ease;">
        <span style="font-size: 20px;">👍</span>
        <span id="like-count" style="font-weight: 600; color: #38a169;">${blog.likes || 0}</span>
      </button>
      <button onclick="dislikeBlog(${blog.id})" id="dislike-btn" class="reaction-btn ${userDisliked ? 'active' : ''}" style="display: flex; align-items: center; gap: 8px; padding: 10px 20px; border: 2px solid ${userDisliked ? '#e53e3e' : '#e2e8f0'}; border-radius: 25px; background: ${userDisliked ? '#fff5f5' : 'white'}; cursor: pointer; font-size: 16px; transition: all 0.2s ease;">
        <span style="font-size: 20px;">👎</span>
        <span id="dislike-count" style="font-weight: 600; color: #e53e3e;">${blog.dislikes || 0}</span>
      </button>
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
            <div class="comment-form" style="position: relative;">
              <textarea id="comment-text" placeholder="Share your thoughts... Type @ to mention someone" oninput="handleCommentInput(event)"></textarea>
              <div id="mention-dropdown" class="mention-popup" style="display: none;"></div>
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

// Format @mentions in content - now handles both plain text @username and HTML mention spans
function formatMentions(content) {
  // First handle span mentions from rich editor (data-username attribute)
  let formatted = content.replace(/<span[^>]*class="mention"[^>]*data-username="([^"]+)"[^>]*>@\1<\/span>/g, 
    '<span class="mention" style="color: #6b46c1; background: #f3e8ff; padding: 2px 4px; border-radius: 4px; font-weight: 600;">@$1</span>');
  
  // Then handle plain text @mentions (not already in a span)
  formatted = formatted.replace(/(?<!<[^>]*)@(\w+)(?![^<]*>)/g, 
    '<span class="mention" style="color: #6b46c1; background: #f3e8ff; padding: 2px 4px; border-radius: 4px; font-weight: 600;">@$1</span>');
  
  return formatted;
}

// ===== COMMENT @MENTION FUNCTIONALITY =====
let commentMentionData = {
  dropdown: null,
  textarea: null,
  searchTerm: '',
  selectedIndex: 0,
  users: [],
  atPosition: -1
};

// Handle @ mention input in comments
async function handleCommentInput(event) {
  const textarea = event.target;
  const value = textarea.value;
  const cursorPos = textarea.selectionStart;
  
  // Find if we're typing after an @
  const textBeforeCursor = value.substring(0, cursorPos);
  const atMatch = textBeforeCursor.match(/@(\w*)$/);
  
  const dropdown = document.getElementById('mention-dropdown');
  if (!dropdown) return;
  
  commentMentionData.dropdown = dropdown;
  commentMentionData.textarea = textarea;
  
  if (atMatch) {
    commentMentionData.searchTerm = atMatch[1];
    commentMentionData.atPosition = cursorPos - atMatch[0].length;
    
    // Search for users
    await searchCommentMentions(atMatch[1]);
  } else {
    hideCommentMentionDropdown();
  }
}

async function searchCommentMentions(search) {
  const dropdown = commentMentionData.dropdown;
  if (!dropdown) return;
  
  try {
    const response = await fetch(`https://cirkle-api.marcusray.workers.dev/api/users?search=${encodeURIComponent(search)}`);
    const data = await response.json();
    commentMentionData.users = data.users || [];
    
    if (commentMentionData.users.length === 0) {
      dropdown.innerHTML = '<div class="mention-no-results" style="padding: 12px; color: #718096; font-size: 14px; text-align: center;">No users found</div>';
    } else {
      dropdown.innerHTML = commentMentionData.users.slice(0, 5).map((user, index) => `
        <div class="mention-item ${index === 0 ? 'selected' : ''}" 
             style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; ${index === 0 ? 'background: #f3e8ff;' : ''}"
             onmouseenter="selectCommentMention(${index})"
             onclick="insertCommentMention(${index})">
          <img src="${user.profilePhoto || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
               alt="${user.username}" 
               style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 600; color: #2d3748; font-size: 14px;">${user.nickname || user.username}</span>
            <span style="color: #718096; font-size: 12px;">@${user.username}</span>
          </div>
        </div>
      `).join('');
    }
    
    commentMentionData.selectedIndex = 0;
    positionCommentDropdown();
    dropdown.style.display = 'block';
  } catch (error) {
    console.error('Error searching users:', error);
    hideCommentMentionDropdown();
  }
}

function selectCommentMention(index) {
  commentMentionData.selectedIndex = index;
  const items = commentMentionData.dropdown.querySelectorAll('.mention-item');
  items.forEach((item, i) => {
    item.style.background = i === index ? '#f3e8ff' : '';
    item.classList.toggle('selected', i === index);
  });
}

function insertCommentMention(index) {
  const user = commentMentionData.users[index];
  if (!user || !commentMentionData.textarea) return;
  
  const textarea = commentMentionData.textarea;
  const value = textarea.value;
  const atPos = commentMentionData.atPosition;
  const cursorPos = textarea.selectionStart;
  
  // Replace @searchterm with @username
  const beforeAt = value.substring(0, atPos);
  const afterCursor = value.substring(cursorPos);
  const newValue = beforeAt + '@' + user.username + ' ' + afterCursor;
  
  textarea.value = newValue;
  
  // Move cursor after the mention
  const newCursorPos = atPos + user.username.length + 2;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  textarea.focus();
  
  hideCommentMentionDropdown();
}

function positionCommentDropdown() {
  const textarea = commentMentionData.textarea;
  const dropdown = commentMentionData.dropdown;
  if (!textarea || !dropdown) return;
  
  // Position below the textarea
  dropdown.style.position = 'absolute';
  dropdown.style.width = '250px';
  dropdown.style.top = '100%';
  dropdown.style.left = '0';
  dropdown.style.marginTop = '5px';
}

function hideCommentMentionDropdown() {
  if (commentMentionData.dropdown) {
    commentMentionData.dropdown.style.display = 'none';
  }
  commentMentionData.searchTerm = '';
  commentMentionData.selectedIndex = 0;
  commentMentionData.users = [];
  commentMentionData.atPosition = -1;
}

// Handle keyboard navigation in comment mentions
function handleCommentMentionKeydown(event) {
  const dropdown = commentMentionData.dropdown;
  if (!dropdown || dropdown.style.display === 'none') return;
  
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    commentMentionData.selectedIndex = Math.min(commentMentionData.selectedIndex + 1, commentMentionData.users.length - 1);
    selectCommentMention(commentMentionData.selectedIndex);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    commentMentionData.selectedIndex = Math.max(commentMentionData.selectedIndex - 1, 0);
    selectCommentMention(commentMentionData.selectedIndex);
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    if (commentMentionData.users.length > 0 && dropdown.style.display !== 'none') {
      event.preventDefault();
      insertCommentMention(commentMentionData.selectedIndex);
    }
  } else if (event.key === 'Escape') {
    hideCommentMentionDropdown();
  }
}

// Initialize comment mention keyboard listener
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.id === 'comment-text') {
    handleCommentMentionKeydown(e);
  }
});
// ===== END COMMENT @MENTION FUNCTIONALITY =====

// ===== LIKE/DISLIKE FUNCTIONALITY =====
async function likeBlog(blogId) {
  if (!api.isLoggedIn()) {
    alert('Please log in to like posts');
    return;
  }
  
  try {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      alert('Session expired. Please log in again.');
      return;
    }
    
    const response = await fetch(`https://cirkle-api.marcusray.workers.dev/api/blogs/${blogId}/like`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 401) {
      alert('Session expired. Please log in again.');
      localStorage.removeItem('sessionToken');
      return;
    }
    
    const data = await response.json();
    
    if (data.success) {
      // Update UI
      document.getElementById('like-count').textContent = data.likes;
      document.getElementById('dislike-count').textContent = data.dislikes;
      
      const likeBtn = document.getElementById('like-btn');
      const dislikeBtn = document.getElementById('dislike-btn');
      
      if (data.userLiked) {
        likeBtn.style.border = '2px solid #38a169';
        likeBtn.style.background = '#f0fff4';
      } else {
        likeBtn.style.border = '2px solid #e2e8f0';
        likeBtn.style.background = 'white';
      }
      
      dislikeBtn.style.border = '2px solid #e2e8f0';
      dislikeBtn.style.background = 'white';
    }
  } catch (error) {
    console.error('Error liking post:', error);
  }
}

async function dislikeBlog(blogId) {
  if (!api.isLoggedIn()) {
    alert('Please log in to dislike posts');
    return;
  }
  
  try {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      alert('Session expired. Please log in again.');
      return;
    }
    
    const response = await fetch(`https://cirkle-api.marcusray.workers.dev/api/blogs/${blogId}/dislike`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 401) {
      alert('Session expired. Please log in again.');
      localStorage.removeItem('sessionToken');
      return;
    }
    
    const data = await response.json();
    
    if (data.success) {
      // Update UI
      document.getElementById('like-count').textContent = data.likes;
      document.getElementById('dislike-count').textContent = data.dislikes;
      
      const likeBtn = document.getElementById('like-btn');
      const dislikeBtn = document.getElementById('dislike-btn');
      
      if (data.userDisliked) {
        dislikeBtn.style.border = '2px solid #e53e3e';
        dislikeBtn.style.background = '#fff5f5';
      } else {
        dislikeBtn.style.border = '2px solid #e2e8f0';
        dislikeBtn.style.background = 'white';
      }
      
      likeBtn.style.border = '2px solid #e2e8f0';
      likeBtn.style.background = 'white';
    }
  } catch (error) {
    console.error('Error disliking post:', error);
  }
}
// ===== END LIKE/DISLIKE FUNCTIONALITY =====

// Delete blog post (admin only)
async function deleteBlogPost(blogId) {
  if (!confirm('Are you sure you want to delete this blog post? This action cannot be undone.')) return;
  
  try {
    await api.deleteBlog(blogId);
    alert('Blog post deleted successfully!');
    window.location.hash = 'blog';
  } catch (error) {
    alert('Failed to delete blog post: ' + (error.message || 'Unknown error'));
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

async function submitReply(commentId) {
  const replyText = document.getElementById(`reply-text-${commentId}`);
  const messageDiv = document.getElementById(`reply-message-${commentId}`);
  
  if (!replyText.value.trim()) {
    messageDiv.textContent = 'Please write a reply';
    messageDiv.className = 'error-message';
    messageDiv.style.display = 'block';
    return;
  }

  if (!api.isLoggedIn()) {
    messageDiv.textContent = 'Please log in to reply';
    messageDiv.className = 'error-message';
    messageDiv.style.display = 'block';
    return;
  }

  try {
    messageDiv.textContent = 'Posting reply...';
    messageDiv.className = 'success-message';
    messageDiv.style.display = 'block';
    
    const response = await fetch(`https://cirkle-api.marcusray.workers.dev/api/blogs/${currentBlogId}/comments/${commentId}/replies`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: replyText.value.trim() })
    });
    
    const data = await response.json();
    
    if (response.status === 401) {
      messageDiv.textContent = 'Session expired. Please log in again.';
      messageDiv.className = 'error-message';
      return;
    }
    
    if (response.ok && data.success) {
      messageDiv.textContent = 'Reply posted!';
      replyText.value = '';
      
      // Reload blog to show new reply
      setTimeout(() => {
        loadBlogPost(currentBlogId);
      }, 1000);
    } else {
      messageDiv.textContent = data.error || 'Failed to post reply';
      messageDiv.className = 'error-message';
    }
  } catch (error) {
    console.error('Error posting reply:', error);
    messageDiv.textContent = 'Failed to post reply';
    messageDiv.className = 'error-message';
  }
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
    // Handle query parameters in hash (e.g., blog?create=true)
    const pageId = hash.split('?')[0];
    showPage(pageId);
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