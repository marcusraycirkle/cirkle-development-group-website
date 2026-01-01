# Admin Accounts Quick Reference

## Admin Users (Discord OAuth)

The following Discord users automatically receive admin privileges when they sign up:

### Admin Discord IDs

| Name | Discord ID | Auto-Admin |
|------|-----------|------------|
| Marcus Ray | 1088907566844739624 | ✅ |
| Teejay Everil | 926568979747713095 | ✅ |
| Sam Caster | 1187751127039615086 | ✅ |
| Appler Smith | 1002932344799371354 | ✅ |

### How It Works

1. When these users sign up via Discord OAuth, the system automatically:
   - Creates their account
   - Sets `isAdmin: true`
   - Grants full admin privileges
   - Allows blog creation and management

2. No special login required - just use "Login with Discord" button

3. Admin features unlock automatically upon login

### Admin Capabilities
- Create new blog posts
- Manage content
- View user activity
- Access all admin features

### Public Profile Features

All admin accounts have:
Admins can:
- ✅ Create and publish blog posts
- ✅ Manage all content
- ✅ View user activity and analytics
- ✅ Access admin dashboard
- ✅ Have public profiles visible to all users
- ✅ Get clickable author attribution in blogs
- ✅ Use all social networking features

### Security Note

Admin status is hardcoded by Discord ID in the Cloudflare Worker. To add/remove admins, update the `ADMIN_DISCORD_IDS` array in [worker.js](worker.js) and redeploy.

1. Login with admin credentials
2. Navigate to Admin Dashboard
3. Click "Create Blog Post"
4. Fill in title and content
5. Add banner/thumbnail images (optional)
6. Publish

Your blog posts will automatically:
- Show your name as author
- Link to your profile
- Track engagement metrics
- Allow comments and interactions

### Profile Customization

Even as an admin, you can customize your profile:
1. Go to Dashboard → Profile Settings
2. Update:
   - Nickname/Display Name
   - Pronouns
   - Bio (max 200 characters)
   - Profile Photo URL
3. Save Changes

### Note
- All admin accounts have the same password for simplicity
- Change passwords in production environment
- Admin accounts are automatically created on first load
- Data persists in browser localStorage

---

**Security Reminder**: In production, use strong unique passwords and implement proper authentication!
