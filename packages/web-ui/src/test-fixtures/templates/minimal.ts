export const minimalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact - Horizon Studio</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Inter', sans-serif; margin: 0; }
    h1, h2, h3 { font-family: 'Playfair Display', serif; }
  </style>
</head>
<body>

  <!-- Navigation -->
  <nav class="w-full bg-white border-b border-gray-100" style="padding: 16px 48px;">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div style="width: 32px; height: 32px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
        </div>
        <span style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 600; color: #1f2937;">Horizon Studio</span>
      </div>
      <div class="flex items-center gap-8">
        <a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none; font-weight: 500;">Work</a>
        <a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none; font-weight: 500;">About</a>
        <a href="#" style="font-size: 14px; color: #6366f1; text-decoration: none; font-weight: 600;">Contact</a>
      </div>
    </div>
  </nav>

  <!-- Contact Hero -->
  <section class="w-full bg-white" style="padding: 80px 48px;">
    <div class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
      <div>
        <p style="font-size: 13px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Get in Touch</p>
        <h1 style="font-size: 48px; font-weight: 700; color: #111827; line-height: 1.15; margin: 0 0 20px 0;">Let's start a conversation</h1>
        <p style="font-size: 17px; color: #6b7280; line-height: 1.7; margin: 0 0 40px 0;">Have a project in mind? We'd love to hear about it. Fill out the form and we'll get back to you within 24 hours.</p>

        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 44px; height: 44px; background: #eef2ff; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <div>
              <p style="font-size: 14px; font-weight: 600; color: #111827; margin: 0;">Email</p>
              <p style="font-size: 14px; color: #6b7280; margin: 0;">hello@horizonstudio.co</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 44px; height: 44px; background: #fef3c7; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div>
              <p style="font-size: 14px; font-weight: 600; color: #111827; margin: 0;">Office</p>
              <p style="font-size: 14px; color: #6b7280; margin: 0;">123 Design Street, London EC2A 4NE</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact Form -->
      <div style="background: #fafafa; border-radius: 16px; padding: 40px; border: 1px solid #e5e7eb;">
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">First Name</label>
              <input type="text" placeholder="Jane" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: 'Inter', sans-serif; box-sizing: border-box; outline: none;">
            </div>
            <div>
              <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Last Name</label>
              <input type="text" placeholder="Doe" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: 'Inter', sans-serif; box-sizing: border-box; outline: none;">
            </div>
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Email</label>
            <input type="email" placeholder="jane@company.com" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: 'Inter', sans-serif; box-sizing: border-box; outline: none;">
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Project Type</label>
            <select style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: 'Inter', sans-serif; box-sizing: border-box; outline: none; background: white; color: #6b7280;">
              <option>Website Redesign</option>
              <option>Brand Identity</option>
              <option>Growth Strategy</option>
              <option>Something Else</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Tell us about your project</label>
            <textarea rows="4" placeholder="Share your vision, timeline, and any specific requirements..." style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: 'Inter', sans-serif; box-sizing: border-box; outline: none; resize: vertical;"></textarea>
          </div>
          <button style="width: 100%; padding: 14px; background: #6366f1; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer;">Send Message</button>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="w-full" style="padding: 32px 48px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <p style="font-size: 13px; color: #9ca3af; margin: 0;">2026 Horizon Studio. All rights reserved.</p>
      <div class="flex items-center gap-6">
        <a href="#" style="font-size: 13px; color: #6b7280; text-decoration: none;">Twitter</a>
        <a href="#" style="font-size: 13px; color: #6b7280; text-decoration: none;">Dribbble</a>
        <a href="#" style="font-size: 13px; color: #6b7280; text-decoration: none;">LinkedIn</a>
      </div>
    </div>
  </footer>

</body>
</html>`;
