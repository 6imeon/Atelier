export const aboutHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About - Horizon Studio</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Inter', sans-serif; margin: 0; }
    h1, h2, h3, h4 { font-family: 'Playfair Display', serif; }
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
        <a href="#" style="font-size: 14px; color: #6366f1; text-decoration: none; font-weight: 600;">About</a>
        <a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none; font-weight: 500;">Services</a>
        <a href="#" style="font-size: 14px; background: #6366f1; color: white; text-decoration: none; font-weight: 500; padding: 10px 24px; border-radius: 8px;">Get in Touch</a>
      </div>
    </div>
  </nav>

  <!-- Hero / Mission -->
  <section class="w-full bg-white" style="padding: 80px 48px;">
    <div class="max-w-4xl mx-auto text-center">
      <p style="font-size: 13px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Our Story</p>
      <h1 style="font-size: 52px; font-weight: 700; color: #111827; line-height: 1.15; margin: 0 0 24px 0;">Design with purpose, build with passion</h1>
      <p style="font-size: 18px; color: #6b7280; line-height: 1.8; max-width: 640px; margin: 0 auto;">Founded in 2019, Horizon Studio began with a simple belief: great design should be accessible, intentional, and impactful. We partner with ambitious teams to bring their vision to life.</p>
    </div>
  </section>

  <!-- Values Section -->
  <section class="w-full" style="padding: 80px 48px; background: #fafafa;">
    <div class="max-w-7xl mx-auto">
      <div style="text-align: center; margin-bottom: 56px;">
        <p style="font-size: 13px; font-weight: 600; color: #f59e0b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Our Values</p>
        <h2 style="font-size: 36px; font-weight: 700; color: #111827; margin: 0;">What drives us forward</h2>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div style="text-align: center; padding: 32px;">
          <div style="width: 56px; height: 56px; background: #eef2ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          </div>
          <h3 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Clarity First</h3>
          <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0;">Every decision starts with understanding. We dig deep into problems before proposing solutions, ensuring alignment from day one.</p>
        </div>
        <div style="text-align: center; padding: 32px;">
          <div style="width: 56px; height: 56px; background: #fef3c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>
          </div>
          <h3 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Craft Obsessed</h3>
          <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0;">The difference between good and great is in the details. We obsess over typography, spacing, motion, and micro-interactions.</p>
        </div>
        <div style="text-align: center; padding: 32px;">
          <div style="width: 56px; height: 56px; background: #d1fae5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <h3 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">True Partnership</h3>
          <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0;">We succeed when our clients succeed. That means honest feedback, transparent timelines, and shared ownership of outcomes.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Team Section -->
  <section class="w-full bg-white" style="padding: 80px 48px;">
    <div class="max-w-7xl mx-auto">
      <div style="text-align: center; margin-bottom: 56px;">
        <p style="font-size: 13px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">The Team</p>
        <h2 style="font-size: 36px; font-weight: 700; color: #111827; margin: 0;">Meet the people behind the pixels</h2>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div style="text-align: center;">
          <div style="width: 100%; aspect-ratio: 1; background: linear-gradient(135deg, #c7d2fe, #6366f1); border-radius: 12px; margin-bottom: 16px;"></div>
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">Maya Chen</h3>
          <p style="font-size: 14px; color: #6366f1; font-weight: 500; margin: 0 0 8px 0;">Founder & Creative Director</p>
          <p style="font-size: 13px; color: #9ca3af; margin: 0;">Former design lead at Stripe. 12 years in product design.</p>
        </div>
        <div style="text-align: center;">
          <div style="width: 100%; aspect-ratio: 1; background: linear-gradient(135deg, #fde68a, #f59e0b); border-radius: 12px; margin-bottom: 16px;"></div>
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">James Okafor</h3>
          <p style="font-size: 14px; color: #f59e0b; font-weight: 500; margin: 0 0 8px 0;">Head of Engineering</p>
          <p style="font-size: 13px; color: #9ca3af; margin: 0;">Full-stack architect. Obsessed with performance and clean code.</p>
        </div>
        <div style="text-align: center;">
          <div style="width: 100%; aspect-ratio: 1; background: linear-gradient(135deg, #a7f3d0, #10b981); border-radius: 12px; margin-bottom: 16px;"></div>
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">Priya Sharma</h3>
          <p style="font-size: 14px; color: #10b981; font-weight: 500; margin: 0 0 8px 0;">Brand Strategist</p>
          <p style="font-size: 13px; color: #9ca3af; margin: 0;">Turns business goals into compelling brand narratives.</p>
        </div>
        <div style="text-align: center;">
          <div style="width: 100%; aspect-ratio: 1; background: linear-gradient(135deg, #e0e7ff, #818cf8); border-radius: 12px; margin-bottom: 16px;"></div>
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">Luca Moretti</h3>
          <p style="font-size: 14px; color: #818cf8; font-weight: 500; margin: 0 0 8px 0;">Motion Designer</p>
          <p style="font-size: 13px; color: #9ca3af; margin: 0;">Brings interfaces to life with purposeful animation and interaction.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Stats Section -->
  <section class="w-full" style="padding: 64px 48px; background: #111827;">
    <div class="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8" style="text-align: center;">
      <div>
        <p style="font-size: 48px; font-weight: 700; color: #6366f1; margin: 0;">80+</p>
        <p style="font-size: 14px; color: #9ca3af; margin: 4px 0 0;">Projects Delivered</p>
      </div>
      <div>
        <p style="font-size: 48px; font-weight: 700; color: #f59e0b; margin: 0;">12</p>
        <p style="font-size: 14px; color: #9ca3af; margin: 4px 0 0;">Team Members</p>
      </div>
      <div>
        <p style="font-size: 48px; font-weight: 700; color: #10b981; margin: 0;">98%</p>
        <p style="font-size: 14px; color: #9ca3af; margin: 4px 0 0;">Client Retention</p>
      </div>
      <div>
        <p style="font-size: 48px; font-weight: 700; color: #818cf8; margin: 0;">5</p>
        <p style="font-size: 14px; color: #9ca3af; margin: 4px 0 0;">Years Running</p>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="w-full bg-white" style="padding: 80px 48px;">
    <div class="max-w-3xl mx-auto text-center">
      <h2 style="font-size: 40px; font-weight: 700; color: #111827; margin: 0 0 16px 0;">Want to join the team?</h2>
      <p style="font-size: 18px; color: #6b7280; margin: 0 0 32px 0;">We are always looking for talented designers, engineers, and strategists who care about craft.</p>
      <a href="#" style="display: inline-block; padding: 14px 36px; background: #6366f1; color: white; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none;">View Open Roles</a>
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
