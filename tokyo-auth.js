(function (global) {
  'use strict';

  function getCurrentUser() {
    try {
      var saved = localStorage.getItem('tokyo_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  global.TokyoPicksSession = {
    usesFirebase: function () {
      return false;
    },
    getUser: function () {
      return getCurrentUser();
    }
  };

  function updateNavUI(user) {
    var userMenu = document.getElementById('user-menu-container');
    var loginBtn = document.getElementById('login-nav-btn');
    var userNameDisplay = document.getElementById('user-name-display');
    if (user) {
      if (userMenu) userMenu.style.display = 'inline-block';
      if (loginBtn) loginBtn.style.display = 'none';
      if (userNameDisplay) userNameDisplay.textContent = user.name || user.email;
    } else {
      if (userMenu) userMenu.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'inline-flex';
    }
  }

  function mergeCartForUser(user) {
    if (!user || !user.email) return;
    var userCart = localStorage.getItem('tokyo_cart_' + user.email);
    if (userCart) {
      localStorage.setItem('tokyo_cart_items', userCart);
    }
  }

  function setupUserDropdown() {
    var userBtn = document.getElementById('user-btn');
    var userDropdown = document.getElementById('user-dropdown-menu');
    if (userBtn && userDropdown) {
      userBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        userDropdown.classList.toggle('active');
      });
      document.addEventListener('click', function (e) {
        if (!userDropdown.contains(e.target) && !userBtn.contains(e.target)) {
          userDropdown.classList.remove('active');
        }
      });
    }
  }

  function performLogout(opts) {
    opts = opts || {};
    var user = global.TokyoPicksSession.getUser();
    if (user && user.email) {
      var currentCart = localStorage.getItem('tokyo_cart_items') || '[]';
      localStorage.setItem('tokyo_cart_' + user.email, currentCart);
    }

    function finish() {
      localStorage.removeItem('tokyo_cart_items');
      localStorage.removeItem('tokyo_current_user');
      if (opts.redirect) {
        window.location.href = opts.redirect;
      } else {
        window.location.reload();
      }
    }

    finish();
  }

  global.TokyoPicksAuth = {
    mountNav: function (opts) {
      opts = opts || {};
      var mergeCartOnLoad = !!opts.mergeCartOnLoad;
      var hookCartSave = !!opts.hookCartSave;
      var logoutRedirect = opts.logoutRedirect || null;

      setupUserDropdown();

      var logoutLink = document.getElementById('logout-link');
      if (logoutLink) {
        logoutLink.addEventListener('click', function (e) {
          e.preventDefault();
          performLogout({
            redirect: logoutRedirect || undefined
          });
        });
      }

      var lu = getCurrentUser();
      updateNavUI(lu);
      if (lu && mergeCartOnLoad) {
        mergeCartForUser(lu);
      }
      if (typeof opts.onUserChange === 'function') {
        opts.onUserChange(lu);
      }

      if (hookCartSave) {
        var originalSetItem = localStorage.setItem;
        localStorage.setItem = function (key, value) {
          originalSetItem.call(this, key, value);
          if (key === 'tokyo_cart_items') {
            var u = global.TokyoPicksSession.getUser();
            if (u && u.email) {
              originalSetItem.call(this, 'tokyo_cart_' + u.email, value);
            }
          }
        };
      }
    },

    formatAuthError: function (err) {
      return (err && err.message) || 'Something went wrong.';
    },

    logout: performLogout
  };
})(typeof window !== 'undefined' ? window : this);
