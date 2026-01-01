/**
 * API Client for Cirkle Development Group
 * Handles all backend communication with Cloudflare Workers
 */

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8787/api'  // For local development
  : 'https://cirkle-api.marcusray.workers.dev/api';  // Production

// Note: Website deployed at https://group.cirkledevelopment.co.uk

class APIClient {
  constructor() {
    this.sessionToken = localStorage.getItem('sessionToken');
  }

  // Helper to make authenticated requests
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Set session token
  setSession(token) {
    this.sessionToken = token;
    localStorage.setItem('sessionToken', token);
  }

  // Clear session
  clearSession() {
    this.sessionToken = null;
    localStorage.removeItem('sessionToken');
  }

  // Authentication methods
  async getDiscordAuthUrl() {
    const data = await this.request('/auth/discord/url');
    return data.url;
  }

  async handleDiscordCallback(code) {
    const data = await this.request('/auth/discord/callback', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    
    if (data.sessionId) {
      this.setSession(data.sessionId);
    }
    
    return data;
  }

  async verifyMyCirkle() {
    return await this.request('/auth/verify-mycirkle', {
      method: 'POST',
    });
  }

  async completeProfile(bio) {
    return await this.request('/auth/complete-profile', {
      method: 'POST',
      body: JSON.stringify({ bio }),
    });
  }

  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } finally {
      this.clearSession();
    }
  }

  // User methods
  async getCurrentUser() {
    return await this.request('/users/me');
  }

  async updateProfile(updates) {
    return await this.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getUserById(userId) {
    return await this.request(`/users/${userId}`);
  }

  // Blog methods
  async getAllBlogs() {
    const response = await this.request('/blogs');
    return response.blogs || [];
  }

  async getBlogById(blogId) {
    return await this.request(`/blogs/${blogId}`);
  }

  async createBlog(blogData) {
    return await this.request('/blogs', {
      method: 'POST',
      body: JSON.stringify(blogData),
    });
  }

  async deleteBlog(blogId) {
    return await this.request(`/blogs/${blogId}`, {
      method: 'DELETE',
    });
  }

  async addComment(blogId, content) {
    return await this.request(`/blogs/${blogId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async addReply(blogId, commentId, content) {
    return await this.request(`/blogs/${blogId}/comments/${commentId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Suggestion methods
  async submitSuggestion(title, description) {
    return await this.request('/suggestions', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
  }

  async getAllSuggestions() {
    const response = await this.request('/suggestions');
    return response.suggestions || [];
  }

  // Check if logged in
  isLoggedIn() {
    return !!this.sessionToken;
  }
}

// Create global API client instance
const api = new APIClient();
