/**
 * Login page – form validation and submit handling
 * Capstone Project
 */

(function () {
  'use strict';

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const submitBtn = document.getElementById('submitBtn');

  /**
   * Validate email format
   * @param {string} value
   * @returns {boolean}
   */
  function isValidEmail(value) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value);
  }

  /**
   * Show error on field and set message
   * @param {HTMLInputElement} input
   * @param {HTMLElement} errorEl
   * @param {string} message
   */
  function setError(input, errorEl, message) {
    input.classList.add('error');
    errorEl.textContent = message;
  }

  /**
   * Clear error from field
   * @param {HTMLInputElement} input
   * @param {HTMLElement} errorEl
   */
  function clearError(input, errorEl) {
    input.classList.remove('error');
    errorEl.textContent = '';
  }

  /**
   * Validate email field
   * @returns {boolean}
   */
  function validateEmail() {
    const value = emailInput.value.trim();
    if (!value) {
      setError(emailInput, emailError, 'Email is required.');
      return false;
    }
    if (!isValidEmail(value)) {
      setError(emailInput, emailError, 'Please enter a valid email address.');
      return false;
    }
    clearError(emailInput, emailError);
    return true;
  }

  /**
   * Validate password field
   * @returns {boolean}
   */
  function validatePassword() {
    const value = passwordInput.value;
    if (!value) {
      setError(passwordInput, passwordError, 'Password is required.');
      return false;
    }
    if (value.length < 6) {
      setError(passwordInput, passwordError, 'Password must be at least 6 characters.');
      return false;
    }
    clearError(passwordInput, passwordError);
    return true;
  }

  /**
   * Run all validations
   * @returns {boolean}
   */
  function validateForm() {
    const emailOk = validateEmail();
    const passwordOk = validatePassword();
    return emailOk && passwordOk;
  }

  /**
   * Set submit button loading state
   * @param {boolean} loading
   */
  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Signing in…' : 'Sign in';
  }

  /**
   * Handle form submit (replace with your real auth logic)
   * @param {Event} e
   */
  function handleSubmit(e) {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    // Replace this with your actual login API call or auth logic
    // Example: fetch('/api/login', { method: 'POST', body: formData })
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Simulate API call – remove and use your backend
    setTimeout(function () {
      setLoading(false);
      console.log('Login attempt:', data);
      // On success you might do: window.location.href = '/dashboard';
      alert('Login form is ready. Connect this to your backend or auth service.');
    }, 800);
  }

  // Clear errors on input
  emailInput.addEventListener('input', function () {
    clearError(emailInput, emailError);
  });
  emailInput.addEventListener('blur', validateEmail);

  passwordInput.addEventListener('input', function () {
    clearError(passwordInput, passwordError);
  });
  passwordInput.addEventListener('blur', validatePassword);

  form.addEventListener('submit', handleSubmit);

  /**
   * Theme toggle – light/dark with localStorage persistence
   */
  const THEME_KEY = 'capstone-theme';
  const themeToggle = document.getElementById('themeToggle');

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || 'dark';
    } catch (_) {
      return 'dark';
    }
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    themeToggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {}
  }

  themeToggle.addEventListener('click', function () {
    setTheme(getStoredTheme() === 'light' ? 'dark' : 'light');
  });

  setTheme(getStoredTheme());
})();
