const router = require('express').Router();
const jwt = require('jsonwebtoken');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Invalid username or password' });
  const token = jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

module.exports = router;
