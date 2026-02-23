# Capstone Login Page

A JavaScript-based login page with client-side validation and a dark, modern UI.

## Files

- **index.html** – Page structure and form
- **styles.css** – Layout and styling
- **login.js** – Validation and submit handling

## Run locally

Open `index.html` in a browser, or serve the folder with a local server:

```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .
```

Then visit `http://localhost:8080` (or the port shown).

## Connecting to your backend

In `login.js`, replace the simulated timeout in `handleSubmit` with your real login logic, for example:

```javascript
fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: data.email,
    password: data.password,
    remember: data.remember === 'on'
  })
})
  .then(res => res.json())
  .then(result => {
    setLoading(false);
    if (result.success) {
      window.location.href = '/dashboard'; // or your app URL
    } else {
      passwordError.textContent = result.message || 'Invalid email or password.';
    }
  })
  .catch(() => {
    setLoading(false);
    passwordError.textContent = 'Something went wrong. Try again.';
  });
```

## Validation

- **Email**: Required, valid email format
- **Password**: Required, minimum 6 characters

Errors clear as the user types and are re-checked on blur and submit.
