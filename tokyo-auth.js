(function (global) {
  'use strict';

  var memoryStore = {};

  function safeGetStorage(type) {
    try {
      return type === 'local' ? global.localStorage : global.sessionStorage;
    } catch (e) {
      return null;
    }
  }

  function getRaw(key) {
    var ls = safeGetStorage('local');
    var ss = safeGetStorage('session');
    var value = null;
    try {
      if (ls) value = ls.getItem(key);
    } catch (e) {}
    if (value == null) {
      try {
        if (ss) value = ss.getItem(key);
      } catch (e2) {}
    }
    if (value == null && Object.prototype.hasOwnProperty.call(memoryStore, key)) {
      value = memoryStore[key];
    }
    return value;
  }

  function setRaw(key, value) {
    var serialized = String(value);
    var ls = safeGetStorage('local');
    var ss = safeGetStorage('session');
    var persisted = false;
    try {
      if (ls) {
        ls.setItem(key, serialized);
        persisted = true;
      }
    } catch (e) {}
    try {
      if (ss) {
        ss.setItem(key, serialized);
        persisted = true;
      }
    } catch (e2) {}
    memoryStore[key] = serialized;
    return persisted;
  }

  function removeRaw(key) {
    var ls = safeGetStorage('local');
    var ss = safeGetStorage('session');
    try {
      if (ls) ls.removeItem(key);
    } catch (e) {}
    try {
      if (ss) ss.removeItem(key);
    } catch (e2) {}
    delete memoryStore[key];
  }

  function getJSON(key, fallback) {
    var raw = getRaw(key);
    if (raw == null || raw === '') return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function setJSON(key, value) {
    return setRaw(key, JSON.stringify(value));
  }

  global.TokyoPicksDB = {
    get: getRaw,
    set: setRaw,
    remove: removeRaw,
    getJSON: getJSON,
    setJSON: setJSON
  };

  function getCurrentUser() {
    return getJSON('tokyo_current_user', null);
  }

  function getUserStateKey(email) {
    return 'tokyo_user_state_' + email;
  }

  function parseCartItems(raw) {
    if (raw == null || raw === '') return [];
    try {
      var a = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function mergeCartByTitle(baseArr, extraArr) {
    var out = baseArr.map(function (item) {
      return Object.assign({}, item, { quantity: Number(item.quantity) || 1 });
    });
    extraArr.forEach(function (bi) {
      var t = bi.title || '';
      var ex = null;
      for (var i = 0; i < out.length; i++) {
        if ((out[i].title || '') === t) {
          ex = out[i];
          break;
        }
      }
      var q = Number(bi.quantity) || 1;
      if (ex) ex.quantity = (Number(ex.quantity) || 1) + q;
      else out.push(Object.assign({}, bi, { quantity: q }));
    });
    return out;
  }

  function saveUserState(user) {
    if (!user || !user.email) return;
    var cart = getRaw('tokyo_cart_items') || '[]';
    setRaw('tokyo_cart_' + user.email, cart);
    setJSON(
      getUserStateKey(user.email),
      {
        cartItems: cart,
        updatedAt: Date.now()
      }
    );
  }

  function restoreUserState(user) {
    if (!user || !user.email) return;
    var guestItems = parseCartItems(getRaw('tokyo_cart_items'));
    var state = getJSON(getUserStateKey(user.email), null);
    var userCartRaw = null;
    if (state && state.cartItems != null) {
      userCartRaw = state.cartItems;
    }
    if (userCartRaw == null) {
      userCartRaw = getRaw('tokyo_cart_' + user.email) || '[]';
    }
    var userItems = parseCartItems(userCartRaw);

    var lastLogout = null;
    try {
      lastLogout = global.sessionStorage
        ? global.sessionStorage.getItem('tokyo_last_logout_email')
        : null;
    } catch (e0) {}

    var merged;
    if (lastLogout && lastLogout !== user.email) {
      merged = userItems;
    } else {
      merged = mergeCartByTitle(userItems, guestItems);
    }
    try {
      if (lastLogout) global.sessionStorage.removeItem('tokyo_last_logout_email');
    } catch (e1) {}

    var mergedStr = JSON.stringify(merged);
    setRaw('tokyo_cart_items', mergedStr);
    setRaw('tokyo_cart_' + user.email, mergedStr);
    setJSON(getUserStateKey(user.email), {
      cartItems: mergedStr,
      updatedAt: Date.now()
    });
  }

  global.TokyoPicksSession = {
    usesFirebase: function () {
      return false;
    },
    getUser: function () {
      return getCurrentUser();
    },
    restoreAllData: function (user) {
      restoreUserState(user || getCurrentUser());
    }
  };

  function updateNavUI(user) {
    var userMenu = document.getElementById('user-menu-container');
    var loginBtn = document.getElementById('login-nav-btn');
    var userNameDisplay = document.getElementById('user-name-display');
    if (user) {
      if (userMenu) userMenu.style.display = 'inline-block';
      if (loginBtn) loginBtn.style.display = 'none';
      if (userNameDisplay) {
        userNameDisplay.textContent = user.name || user.email;
        userNameDisplay.setAttribute(
          'aria-label',
          'View profile: ' + (user.name || user.email)
        );
      }
    } else {
      if (userMenu) userMenu.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'inline-flex';
    }
  }

  function mergeCartForUser(user) {
    restoreUserState(user);
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
      saveUserState(user);
      try {
        if (global.sessionStorage) {
          global.sessionStorage.setItem('tokyo_last_logout_email', user.email);
        }
      } catch (e) {}
    }

    function finish() {
      removeRaw('tokyo_current_user');
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
        var cartRaw = getRaw('tokyo_cart_items');
        var currentUser = getCurrentUser();
        if (currentUser && currentUser.email && cartRaw != null) {
          setRaw('tokyo_cart_' + currentUser.email, cartRaw);
          setJSON(getUserStateKey(currentUser.email), {
            cartItems: cartRaw,
            updatedAt: Date.now()
          });
        }
      }

      global.addEventListener('storage', function (e) {
        if (!e || e.key !== 'tokyo_current_user') return;
        updateNavUI(getCurrentUser());
      });
    },

    formatAuthError: function (err) {
      return (err && err.message) || 'Something went wrong.';
    },

    logout: performLogout
  };
})(typeof window !== 'undefined' ? window : this);
