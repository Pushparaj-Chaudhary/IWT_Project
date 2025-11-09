// ✅ Unified message display (error = red, success = green)
function showMessage(message, elementId, type = "error") {
  const el = document.getElementById(elementId);
  if (el) {
    const color = type === "success" ? "green" : "red";
    el.innerHTML = `<p style="color:${color};font-size:0.9rem;">${message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const usernameRegex = /^[a-zA-Z]/;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ===================== SIGNUP (no OTP) =====================
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = signupForm.username.value.trim();
      const email = signupForm.email.value.trim();
      const password = signupForm.password.value.trim();
      const profileImage = signupForm.profileImage.files[0];

      if (!usernameRegex.test(username))
        return showMessage("Username must start with a letter!", "signupMessage");
      if (!passwordRegex.test(password))
        return showMessage("Password must contain letters, numbers, and special chars", "signupMessage");
      if (!emailRegex.test(email))
        return showMessage("Invalid email address!", "signupMessage");
      if (!profileImage)
        return showMessage("Please upload a profile image!", "signupMessage");

      const formData = new FormData();
      formData.append("username", username);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("profileImage", profileImage);

      try {
        const res = await fetch("/signup", { method: "POST", body: formData });
        const data = await res.json();

        if (res.ok && data.success) {
          showMessage("✅ Signup successful! Redirecting...", "signupMessage", "success");
          setTimeout(() => (window.location.href = "/index.html"), 1000);
        } else {
          showMessage(data.message || "Error signing up", "signupMessage");
        }
      } catch {
        showMessage("Server error. Try again later.", "signupMessage");
      }
    });
  }

  // ===================== LOGIN =====================
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value.trim();

      try {
        const res = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (data.success) {
          showMessage("✅ Login successful! Redirecting...", "loginMessage", "success");
          setTimeout(() => (window.location.href = data.redirect), 800);
        } else {
          showMessage(data.message || "Invalid email or password", "loginMessage");
        }
      } catch {
        showMessage("Server error. Please try again later.", "loginMessage");
      }
    });
  }

  // ===================== UI Navigation =====================
  const loginSection = document.getElementById("loginSection");
  const signupSection = document.getElementById("signupSection");
  const forgotSection = document.getElementById("forgotSection");

  document.getElementById("showSignup")?.addEventListener("click", (e) => {
    e.preventDefault();
    loginSection.style.display = "none";
    signupSection.style.display = "block";
    forgotSection.style.display = "none";
  });

  document.getElementById("backToLoginFromSignup")?.addEventListener("click", () => {
    signupSection.style.display = "none";
    loginSection.style.display = "block";
  });

  document.getElementById("forgotPasswordLink")?.addEventListener("click", (e) => {
    e.preventDefault();
    loginSection.style.display = "none";
    signupSection.style.display = "none";
    forgotSection.style.display = "block";
  });

  document.getElementById("backToLoginFromForgot")?.addEventListener("click", () => {
    forgotSection.style.display = "none";
    loginSection.style.display = "block";
  });

  // ===================== FORGOT PASSWORD =====================
  const sendResetOtp = document.getElementById("sendResetOtp");
  const resetPasswordBtn = document.getElementById("resetPassword");

  if (sendResetOtp) {
    sendResetOtp.onclick = async () => {
      const email = document.getElementById("resetEmail").value.trim();
      if (!email) return showMessage("Enter your email", "forgotMessage");

      try {
        const res = await fetch("/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          document.getElementById("forgotStep1").style.display = "none";
          document.getElementById("forgotStep2").style.display = "block";
          showMessage("OTP sent to your email!", "forgotMessage", "success");
        } else {
          showMessage(data.message || "Error sending OTP", "forgotMessage");
        }
      } catch {
        showMessage("Error sending OTP. Try again later.", "forgotMessage");
      }
    };
  }

  if (resetPasswordBtn) {
    resetPasswordBtn.onclick = async () => {
      const email = document.getElementById("resetEmail").value.trim();
      const otp = document.getElementById("resetOtp").value.trim();
      const newPass = document.getElementById("newPassword").value.trim();
      const confirm = document.getElementById("confirmNewPassword").value.trim();

      if (newPass !== confirm)
        return showMessage("Passwords do not match", "forgotMessage");

      try {
        const res = await fetch("/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp, newPassword: newPass }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          showMessage("Password reset successfully! Redirecting...", "forgotMessage", "success");
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showMessage(data.message || "Error resetting password", "forgotMessage");
        }
      } catch {
        showMessage("Server error while resetting password.", "forgotMessage");
      }
    };
  }

  // ===================== LOAD USER PROFILE =====================
  (async function loadUserProfile() {
    try {
      const res = await fetch("/api/user");
      const data = await res.json();

      if (data.success && data.user) {
        const { username, email, profile_image } = data.user;
        const imgSrc = `${profile_image || "/uploads/default.png"}?t=${Date.now()}`;

        const triggerImg = document.querySelector(".profile-trigger img");
        const profilePhoto = document.querySelector(".dropdown-menu .profile-photo");
        const userName = document.querySelector(".dropdown-menu .user-name");
        const userEmail = document.querySelector(".dropdown-menu .user-email");

        if (triggerImg) triggerImg.src = imgSrc;
        if (profilePhoto) profilePhoto.src = imgSrc;
        if (userName) userName.textContent = username;
        if (userEmail) userEmail.textContent = email;
      }
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  })();

  // ===================== PROFILE DROPDOWN =====================
  const profileDropdown = document.querySelector(".profile-dropdown");
  const trigger = document.querySelector(".profile-trigger");

  if (trigger && profileDropdown) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle("active");
    });

    document.addEventListener("click", () => {
      profileDropdown.classList.remove("active");
    });
  }

  // ===================== 🖼️ GALLERY =====================
  if (document.getElementById("memories") || document.getElementById("Public-memories")) {
    (async function loadMemories() {
      try {
        const [myRes, allRes] = await Promise.all([
          fetch("/api/my-memories"),
          fetch("/api/memories"),
        ]);

        const my_memories = await myRes.json();
        const memories = await allRes.json();

        const privateContainer = document.getElementById("memories");
        const feedContainer = document.getElementById("Public-memories");

        if (privateContainer) privateContainer.innerHTML = "";
        if (feedContainer) feedContainer.innerHTML = "";

        // 🏠 Private Gallery
        if (privateContainer) {
          my_memories.forEach((m) => {
            const card = document.createElement("div");
            card.className = "memory-card";
            card.innerHTML = `
              <img src="${m.image_path}" alt="Memory">
              <div class="card-actions">
                <button class="view-icon" data-img="${m.image_path}">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </button>
                <button class="delete-icon" data-id="${m.id}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
              <div class="info">
                <span class="emotion">${m.emotion || ""}</span>
                <p>${m.username || "You"}</p>
                <p>${m.caption || ""}</p>
                <p>${new Date(m.created_at).toLocaleDateString()}</p>
              </div>
            `;
            privateContainer.appendChild(card);
          });
        }

        // 🌍 Feed (All users)
        if (feedContainer) {
          memories.forEach((m) => {
            const feedCard = document.createElement("div");
            feedCard.className = "memory-card post-style";
            feedCard.dataset.id = m.id;

            feedCard.innerHTML = `
              <div class="post-header">
                <img src="${m.profile_image || "/uploads/default.png"}" alt="User" class="post-avatar">
                <div class="post-user-info">
                  <p class="username">${m.username}</p>
                  <span class="date">${new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <img src="${m.image_path}" alt="Memory" class="post-image">

              <div class="post-actions">
                <button class="like-btn ${m.liked ? "liked" : ""}" data-id="${m.id}">
                  ❤️ <span class="like-count">${m.likes || 0}</span>
                </button>

                <button class="comment-toggle" data-id="${m.id}">
                  💬 <span class="comment-count">${m.comments ? m.comments.length : 0}</span>
                </button>
              </div>

              <div class="post-caption">${m.caption || ""}</div>
              <div class="post-emotion">${m.emotion ? "💫 " + m.emotion : ""}</div>

              <div class="comments-section" id="comments-${m.id}" style="display:none;">
                <div class="comments-list">
                  ${(m.comments || [])
                    .map((c) => `<div class="comment"><strong>${c.user}</strong> ${c.text}</div>`)
                    .join("")}
                </div>
                <div class="add-comment">
                  <input type="text" placeholder="Add a comment..." class="comment-input" data-id="${m.id}">
                  <button class="comment-submit" data-id="${m.id}">Post</button>
                </div>
              </div>
            `;
            feedContainer.appendChild(feedCard);
          });
        }

        // ❤️ Like button
        document.addEventListener("click", async (e) => {
          const btn = e.target.closest(".like-btn");
          if (!btn) return;

          const id = btn.dataset.id;
          try {
            const res = await fetch(`/api/like/${id}`, { method: "POST" });
            const data = await res.json();

            if (res.ok) {
              btn.querySelector(".like-count").textContent = data.likes;
              btn.classList.toggle("liked", data.liked);
            }
          } catch (err) {
            console.error("Like failed:", err);
          }
        });

        // 💬 Comment toggle
        document.addEventListener("click", (e) => {
          const toggle = e.target.closest(".comment-toggle");
          if (!toggle) return;
          const id = toggle.dataset.id;
          const section = document.getElementById(`comments-${id}`);
          section.style.display = section.style.display === "block" ? "none" : "block";
        });

        // 💬 Comment submit
        document.addEventListener("click", async (e) => {
          const btn = e.target.closest(".comment-submit");
          if (!btn) return;

          const id = btn.dataset.id;
          const input = document.querySelector(`.comment-input[data-id="${id}"]`);
          const text = input.value.trim();
          if (!text) return;

          try {
            const res = await fetch(`/api/comment/${id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text }),
            });
            const data = await res.json();

            if (res.ok) {
              const list = document.querySelector(`#comments-${id} .comments-list`);
              list.insertAdjacentHTML(
                "beforeend",
                `<div class="comment"><strong>${data.user}</strong> ${data.text}</div>`
              );
              input.value = "";
              const countSpan = document.querySelector(
                `.comment-toggle[data-id="${id}"] .comment-count`
              );
              countSpan.textContent = parseInt(countSpan.textContent) + 1;
            }
          } catch (err) {
            console.error("Comment failed:", err);
          }
        });

        // 🗑️ Delete handler
        document.addEventListener("click", async (e) => {
          const btn = e.target.closest(".delete-icon");
          if (btn) {
            const id = btn.dataset.id;
            if (confirm("Are you sure you want to delete this memory?")) {
              try {
                const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
                if (res.ok) {
                  btn.closest(".memory-card").remove();
                  alert("Memory deleted successfully!");
                } else {
                  alert("Error deleting memory.");
                }
              } catch (err) {
                console.error("Delete failed:", err);
              }
            }
          }
        });

        // 🖼️ View full image modal
        document.addEventListener("click", (e) => {
          const btn = e.target.closest(".view-icon");
          if (!btn) return;
          const modal = document.getElementById("imageModal");
          const modalImg = document.getElementById("modalImage");
          modal.style.display = "block";
          modalImg.src = btn.dataset.img;
        });

        const modal = document.getElementById("imageModal");
        const closeBtn = document.querySelector(".close");
        if (closeBtn) closeBtn.onclick = () => (modal.style.display = "none");
        window.onclick = (event) => {
          if (event.target === modal) modal.style.display = "none";
        };
      } catch (err) {
        console.error(err);
        showError("Unable to load memories.", "memories");
      }
    })();
  }

  // ===================== 📤 Upload Validation =====================
  const uploadForm = document.getElementById("uploadForm");
  if (uploadForm) {
    uploadForm.addEventListener("submit", (e) => {
      const file = document.querySelector('input[name="image"]').files[0];
      if (!file) {
        e.preventDefault();
        showError("Please select an image!", "uploadForm");
      }
    });
  }

  // ===================== 🍔 Hamburger Menu =====================
  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");
  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navLinks.classList.toggle("active");
  });

  // ===================== 🧠 Load Sidebar Users =====================
  async function loadUsersSidebar() {
    try {
      const res = await fetch("/api/users/all");
      const data = await res.json();
      const container = document.getElementById("sidebar-users");
      container.innerHTML = "";

      if (data.success) {
        data.users.forEach((u) => {
          const div = document.createElement("div");
          div.className = "user-card";
          div.innerHTML = `
            <img src="${u.profile_image}" class="avatar">
            <span>${u.username}</span>
            <button 
              class="follow-btn ${u.is_following ? "following" : ""}" 
              data-id="${u.id}"
              data-follows-back="${u.follows_back}"
              data-following="${u.is_following}"
            >
              ${
                u.is_following
                  ? u.follows_back
                    ? "Friends"
                    : "Following"
                  : "Follow"
              }
            </button>
          `;
          container.appendChild(div);
        });
      }
    } catch (err) {
      console.error("Error loading users:", err);
    }
  }

  // ===================== ⚙️ Follow / Unfollow =====================
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".follow-btn");
    if (!btn) return;

    const id = btn.dataset.id;
    const res = await fetch(`/api/follow/${id}`, { method: "POST" });
    await res.json();
    window.location.reload();
  });

  // ===================== 🎨 Hover Effect (Friends → Unfriend) =====================
  document.addEventListener("mouseover", (e) => {
    const btn = e.target.closest(".follow-btn");
    if (btn && btn.textContent.trim() === "Friends") {
      btn.dataset.originalText = "Friends";
      btn.textContent = "Unfriend";
      btn.classList.add("unfriend-hover");
    }
  });

  document.addEventListener("mouseout", (e) => {
    const btn = e.target.closest(".follow-btn");
    if (btn && btn.classList.contains("unfriend-hover")) {
      btn.textContent = btn.dataset.originalText;
      btn.classList.remove("unfriend-hover");
    }
  });

  // ===================== 🚀 Initial Load =====================
  loadUsersSidebar();
});

// ===================== 📂 Sidebar Toggle =====================
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebarToggle");

  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("active");
    toggle.classList.toggle("active");
  });

  document.addEventListener("click", (e) => {
    if (
      sidebar.classList.contains("active") &&
      !sidebar.contains(e.target) &&
      !toggle.contains(e.target)
    ) {
      sidebar.classList.remove("active");
      toggle.classList.remove("active");
    }
  });
});
