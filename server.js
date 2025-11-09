require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 📁 Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// 📸 Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// 🧩 MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

// ✅ Unified query function
async function queryDB(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

// ✅ Test DB connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ DB connection error:', err);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL');
  connection.release();
});

// 📧 Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});
transporter.verify((err) => {
  if (err) console.warn('⚠️ Nodemailer verify failed:', err);
  else console.log('✅ Nodemailer ready');
});

// 🧠 Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 },
  })
);

// 📤 Multer setup
const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadsDir),
    filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
  }),
});

// ======================
// 🔹 REGEX VALIDATION
// ======================
const usernameRegex = /^[a-zA-Z]/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ======================
// 🔹 SIGNUP
// ======================
app.post('/signup', upload.single('profileImage'), async (req, res) => {
  const { username, email, password } = req.body;
  const profileImage = req.file ? `/uploads/${req.file.filename}` : 'default.png';

  if (!usernameRegex.test(username))
    return res.status(400).json({ success: false, message: 'Username must start with a letter' });
  if (!emailRegex.test(email))
    return res.status(400).json({ success: false, message: 'Invalid email' });
  if (!passwordRegex.test(password))
    return res.status(400).json({
      success: false,
      message: 'Password must contain letters, numbers, and special chars',
    });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await queryDB('INSERT INTO users (username, email, password, profile_image) VALUES (?, ?, ?, ?)', [
      username,
      email,
      hashedPassword,
      profileImage,
    ]);
    res.json({ success: true, message: 'Signup successful' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ success: false, message: 'Email or username already exists' });
    console.error('DB error (signup):', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// ======================
// 🔹 LOGIN
// ======================
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const results = await queryDB('SELECT id, username, email, password, profile_image FROM users WHERE email = ?', [email]);
    if (results.length === 0)
      return res.json({ success: false, message: 'Invalid credentials' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, message: 'Invalid credentials' });

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      profile_image: user.profile_image || 'default.png',
    };
    res.json({ success: true, redirect: '/home.html' });
  } catch (err) {
    console.error('DB error (login):', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ======================
// 🔹 LOGOUT
// ======================
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/index.html'));
});

// ======================
// 🔹 FORGOT PASSWORD (OTP)
// ======================
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !emailRegex.test(email))
    return res.json({ success: true, message: 'If the email exists, an OTP has been sent.' });

  const results = await queryDB('SELECT id FROM users WHERE email = ?', [email]);
  if (results.length === 0)
    return res.json({ success: true, message: 'If the email exists, an OTP has been sent.' });

  const otp = crypto.randomInt(100000, 999999).toString();
  req.session.resetOtp = { code: otp, email, expires: Date.now() + 5 * 60 * 1000 };

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'PixSoul Password Reset OTP',
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    });
    res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ success: false, message: 'Error sending OTP' });
  }
});

// ======================
// 🔹 RESET PASSWORD
// ======================
app.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const sessionOtp = req.session.resetOtp;

  if (!sessionOtp || sessionOtp.email !== email || sessionOtp.code !== otp || Date.now() > sessionOtp.expires)
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

  if (!passwordRegex.test(newPassword))
    return res.status(400).json({
      success: false,
      message: 'Password must contain letters, numbers, and special chars',
    });

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await queryDB('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
  delete req.session.resetOtp;
  res.json({ success: true, message: 'Password reset successfully' });
});

// ======================
// 🔹 AUTH MIDDLEWARE
// ======================
function requireAuth(req, res, next) {
  if (req.session.user) next();
  else res.redirect('/index.html');
}

// ======================
// 🔹 USER ROUTES
// ======================
app.get('/api/user', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const results = await queryDB('SELECT username, email, profile_image FROM users WHERE id = ?', [userId]);
  if (results.length === 0)
    return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user: results[0] });
});

app.get('/api/users/all', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const users = await queryDB(
    `SELECT 
       id, username, profile_image,
       EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = users.id) AS is_following,
       EXISTS(SELECT 1 FROM follows WHERE follower_id = users.id AND following_id = ?) AS follows_back
     FROM users WHERE id != ?`,
    [userId, userId, userId]
  );
  res.json({ success: true, users });
});


// ===================== PROTECTED ROUTES =====================

// Serve protected pages
app.get('/home.html', requireAuth, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'home.html'))
);
app.get('/gallery.html', requireAuth, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'))
);
app.get('/upload.html', requireAuth, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'upload.html'))
);

// ===================== MEMORIES =====================

// 🔹 Fetch user's own memories
app.get('/api/my-memories', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  try {
    const results = await queryDB(
      'SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(results);
  } catch (err) {
    console.error('Error fetching memories:', err);
    res.status(500).send('Error fetching memories');
  }
});

// 🔹 Delete a memory
app.delete('/api/memories/:id', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const memoryId = req.params.id;
  try {
    await queryDB('DELETE FROM memories WHERE id = ? AND user_id = ?', [
      memoryId,
      userId,
    ]);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error deleting memory:', err);
    res.status(500).send('Error deleting memory');
  }
});

// 🔹 Public feed (home feed)
app.get('/api/memories', requireAuth, async (req, res) => {
  try {
    const userId = req.session?.user?.id || 0;

    const memories = await queryDB(
      `
      SELECT 
        m.*, 
        u.username, 
        u.profile_image,
        (SELECT COUNT(*) FROM likes WHERE post_id = m.id) AS likes,
        (SELECT COUNT(*) FROM comments WHERE post_id = m.id) AS comment_count,
        EXISTS(SELECT 1 FROM likes WHERE post_id = m.id AND user_id = ?) AS liked
      FROM memories m
      JOIN users u ON m.user_id = u.id
      WHERE 
        m.user_id = ?
        OR m.user_id IN (
          SELECT f1.following_id
          FROM follows f1
          JOIN follows f2 
            ON f1.following_id = f2.follower_id
          WHERE f1.follower_id = ? AND f2.following_id = ?
        )
      ORDER BY m.created_at DESC
      `,
      [userId, userId, userId, userId]
    );

    const comments = await queryDB(`
      SELECT c.*, u.username AS commenter
      FROM comments c
      JOIN users u ON c.user_id = u.id
    `);

    const memoriesWithExtras = memories.map((m) => ({
      ...m,
      comments: comments
        .filter((c) => c.post_id === m.id)
        .map((c) => ({ user: c.commenter, text: c.text })),
    }));

    res.json(memoriesWithExtras);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching memories');
  }
});

// ===================== LIKE / UNLIKE =====================
app.post('/api/like/:id', requireAuth, async (req, res) => {
  const postId = req.params.id;
  const userId = req.session.user.id;

  try {
    const existing = await queryDB(
      'SELECT * FROM likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    if (existing.length > 0) {
      await queryDB('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [
        postId,
        userId,
      ]);
    } else {
      await queryDB('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [
        postId,
        userId,
      ]);
    }

    const count = await queryDB(
      'SELECT COUNT(*) AS total FROM likes WHERE post_id = ?',
      [postId]
    );
    const liked = await queryDB(
      'SELECT * FROM likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    res.json({ likes: count[0].total, liked: liked.length > 0 });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like/unlike post' });
  }
});

// ===================== COMMENTS =====================
app.post('/api/comment/:id', requireAuth, async (req, res) => {
  const postId = req.params.id;
  const userId = req.session.user.id;
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: 'Comment cannot be empty.' });

  try {
    await queryDB(
      'INSERT INTO comments (post_id, user_id, text) VALUES (?, ?, ?)',
      [postId, userId, text]
    );

    const user = await queryDB('SELECT username FROM users WHERE id = ?', [
      userId,
    ]);

    res.json({
      success: true,
      user: user[0]?.username || 'Unknown',
      text,
    });
  } catch (err) {
    console.error('Comment insert error:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// ===================== FOLLOW / UNFOLLOW =====================
app.post('/api/follow/:id', requireAuth, async (req, res) => {
  const followerId = req.session.user.id;
  const followingId = req.params.id;

  try {
    const existing = await queryDB(
      'SELECT * FROM follows WHERE follower_id = ? AND following_id = ?',
      [followerId, followingId]
    );

    if (existing.length > 0) {
      await queryDB(
        'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
        [followerId, followingId]
      );
      res.json({ following: false });
    } else {
      await queryDB(
        'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
        [followerId, followingId]
      );
      res.json({ following: true });
    }
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).send('Error updating follow status');
  }
});



// ======================
// 🔹 FRIENDS
// ======================
app.get('/api/friends', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const friends = await queryDB(
    `SELECT u.id, u.username, u.profile_image 
     FROM users u
     JOIN follows f1 ON f1.following_id = u.id
     JOIN follows f2 ON f2.follower_id = u.id
     WHERE f1.follower_id = ? AND f2.following_id = ?`,
    [userId, userId]
  );
  res.json(friends);
});

// ======================
// 🔹 UPLOAD MEMORY
// ======================
app.post('/api/upload', requireAuth, upload.single('image'), async (req, res) => {
  const { caption, emotion } = req.body;
  if (!req.file) return res.status(400).send('Image required');

  const imagePath = `/uploads/${req.file.filename}`;
  await queryDB(
    'INSERT INTO memories (user_id, username, emotion, caption, image_path) VALUES (?, ?, ?, ?, ?)',
    [req.session.user.id, req.session.user.username, emotion, caption, imagePath]
  );
  res.redirect('/gallery.html');
});

// ======================
// 🔹 SERVER START
// ======================
app.listen(PORT, () => console.log(`🚀 PixSoul running at http://localhost:${PORT}`));
