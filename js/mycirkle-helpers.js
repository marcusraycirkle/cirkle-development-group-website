/**
 * Helper functions for MyCirkle integration
 */

// Generate MyCirkle badge HTML
function getMyCirkleBadge(user) {
  if (!user || !user.myCirkleVerified) {
    return '';
  }
  
  const tier = user.myCirkleTier || 'basic';
  const tierClass = `tier-${tier}`;
  
  return `<span class="mycirkle-badge ${tierClass}" title="MyCirkle ${tier.charAt(0).toUpperCase() + tier.slice(1)} Member"></span>`;
}

// Format username with MyCirkle badge
function formatUsernameWithBadge(user, usernameOnly = false) {
  if (!user) return '';
  
  const displayName = usernameOnly ? user.username : (user.nickname || user.username);
  const badge = getMyCirkleBadge(user);
  
  return `${displayName}${badge}`;
}

// Check if user is MyCirkle member
function isMyCircleMember(user) {
  return user && user.myCirkleVerified === true;
}

// Get MyCirkle tier display name
function getMyCirkleTierDisplay(tier) {
  const tiers = {
    'basic': 'Basic',
    'bronze': 'Bronze',
    'silver': 'Silver',
    'gold': 'Gold',
    'platinum': 'Platinum'
  };
  
  return tiers[tier] || 'Member';
}

// Update element with username and badge
function updateElementWithBadge(elementId, user) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = formatUsernameWithBadge(user);
  }
}
