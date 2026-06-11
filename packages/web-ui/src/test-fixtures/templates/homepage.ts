export const homepageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Horizon Studio</title>
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
        <a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none; font-weight: 500;">Services</a>
        <a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none; font-weight: 500;">About</a>
        <a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none; font-weight: 500;">Blog</a>
        <a href="#" style="font-size: 14px; background: #6366f1; color: white; text-decoration: none; font-weight: 500; padding: 10px 24px; border-radius: 8px;">Get in Touch</a>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="w-full bg-white" style="padding: 80px 48px;">
    <div class="max-w-7xl mx-auto flex items-center gap-16">
      <div style="flex: 1;">
        <p style="font-size: 13px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Creative Agency</p>
        <h1 style="font-size: 56px; font-weight: 700; color: #111827; line-height: 1.1; margin: 0 0 24px 0;">We craft digital experiences that inspire</h1>
        <p style="font-size: 18px; color: #6b7280; line-height: 1.7; margin-bottom: 32px; max-width: 520px;">Horizon Studio blends strategy, design, and technology to build brands that stand out and products that perform.</p>
        <div class="flex items-center gap-4">
          <a href="#" style="display: inline-block; padding: 14px 32px; background: #6366f1; color: white; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none;">View Our Work</a>
          <a href="#" style="display: inline-block; padding: 14px 32px; background: transparent; color: #6366f1; border: 2px solid #6366f1; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none;">Learn More</a>
        </div>
      </div>
      <div style="flex: 1; aspect-ratio: 4/3; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #f59e0b 100%); border-radius: 16px;"></div>
    </div>
  </section>

  <!-- Services Section -->
  <section class="w-full" style="padding: 80px 48px; background: #fafafa;">
    <div class="max-w-7xl mx-auto">
      <div style="text-align: center; margin-bottom: 56px;">
        <p style="font-size: 13px; font-weight: 600; color: #f59e0b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">What We Do</p>
        <h2 style="font-size: 40px; font-weight: 700; color: #111827; margin: 0;">Services built for growth</h2>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div style="background: white; border-radius: 12px; padding: 40px 32px; border: 1px solid #e5e7eb;">
          <div style="width: 48px; height: 48px; background: #eef2ff; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          </div>
          <h3 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Web Design</h3>
          <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0;">Custom websites designed for impact. We build fast, responsive, and visually stunning digital experiences.</p>
        </div>
        <div style="background: white; border-radius: 12px; padding: 40px 32px; border: 1px solid #e5e7eb;">
          <div style="width: 48px; height: 48px; background: #fef3c7; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <h3 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Brand Identity</h3>
          <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0;">From logo to tone of voice, we create cohesive brand systems that resonate with your audience.</p>
        </div>
        <div style="background: white; border-radius: 12px; padding: 40px 32px; border: 1px solid #e5e7eb;">
          <div style="width: 48px; height: 48px; background: #d1fae5; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <h3 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Growth Strategy</h3>
          <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0;">Data-driven strategies that fuel user acquisition, retention, and sustainable revenue growth.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Featured Work Section -->
  <section class="w-full bg-white" style="padding: 80px 48px;">
    <div class="max-w-7xl mx-auto">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 48px;">
        <div>
          <p style="font-size: 13px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Portfolio</p>
          <h2 style="font-size: 40px; font-weight: 700; color: #111827; margin: 0;">Selected work</h2>
        </div>
        <a href="#" style="font-size: 14px; color: #6366f1; font-weight: 500; text-decoration: none;">View all projects &rarr;</a>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div style="border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="aspect-ratio: 16/10; background: linear-gradient(135deg, #1e1b4b, #6366f1);"></div>
          <div style="padding: 28px 24px;">
            <p style="font-size: 12px; color: #6366f1; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">SaaS Platform</p>
            <h3 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">NovaPay Dashboard Redesign</h3>
            <p style="font-size: 14px; color: #6b7280; margin: 0;">Complete redesign of the payment analytics dashboard, improving task completion by 34%.</p>
          </div>
        </div>
        <div style="border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="aspect-ratio: 16/10; background: linear-gradient(135deg, #7c2d12, #f59e0b);"></div>
          <div style="padding: 28px 24px;">
            <p style="font-size: 12px; color: #f59e0b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">E-Commerce</p>
            <h3 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Ember & Oak Brand Launch</h3>
            <p style="font-size: 14px; color: #6b7280; margin: 0;">End-to-end brand identity and Shopify storefront for an artisan candle maker.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Testimonials Section -->
  <section class="w-full" style="padding: 80px 48px; background: #111827;">
    <div class="max-w-7xl mx-auto">
      <div style="text-align: center; margin-bottom: 56px;">
        <p style="font-size: 13px; font-weight: 600; color: #f59e0b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Testimonials</p>
        <h2 style="font-size: 40px; font-weight: 700; color: white; margin: 0;">What clients say</h2>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div style="background: #1f2937; border-radius: 12px; padding: 36px 32px;">
          <p style="font-size: 16px; color: #d1d5db; line-height: 1.8; margin: 0 0 24px 0; font-style: italic;">"Horizon Studio transformed our online presence. The new site increased conversions by 42% in the first month. Their attention to detail is remarkable."</p>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; background: #6366f1; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px;">AR</div>
            <div>
              <p style="font-size: 14px; color: white; font-weight: 600; margin: 0;">Alex Rivera</p>
              <p style="font-size: 13px; color: #9ca3af; margin: 0;">CEO, NovaPay</p>
            </div>
          </div>
        </div>
        <div style="background: #1f2937; border-radius: 12px; padding: 36px 32px;">
          <p style="font-size: 16px; color: #d1d5db; line-height: 1.8; margin: 0 0 24px 0; font-style: italic;">"Working with Horizon felt like an extension of our own team. They understood our vision from day one and delivered beyond expectations."</p>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; background: #f59e0b; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px;">SL</div>
            <div>
              <p style="font-size: 14px; color: white; font-weight: 600; margin: 0;">Sarah Lin</p>
              <p style="font-size: 13px; color: #9ca3af; margin: 0;">Founder, Ember & Oak</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="w-full bg-white" style="padding: 80px 48px;">
    <div class="max-w-3xl mx-auto text-center">
      <h2 style="font-size: 44px; font-weight: 700; color: #111827; margin: 0 0 16px 0;">Ready to build something great?</h2>
      <p style="font-size: 18px; color: #6b7280; margin: 0 0 32px 0;">Let's discuss your project and explore how Horizon Studio can help you reach your goals.</p>
      <a href="#" style="display: inline-block; padding: 16px 40px; background: #6366f1; color: white; border-radius: 8px; font-weight: 600; font-size: 16px; text-decoration: none;">Start a Conversation</a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="w-full" style="padding: 48px 48px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
    <div class="max-w-7xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-12" style="margin-bottom: 40px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <div style="width: 28px; height: 28px; background: #6366f1; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
            </div>
            <span style="font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 600; color: #1f2937;">Horizon Studio</span>
          </div>
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">Crafting digital experiences that inspire and perform.</p>
        </div>
        <div>
          <h4 style="font-size: 13px; font-weight: 600; color: #111827; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 1px;">Services</h4>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
            <li><a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none;">Web Design</a></li>
            <li><a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none;">Brand Identity</a></li>
            <li><a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none;">Growth Strategy</a></li>
          </ul>
        </div>
        <div>
          <h4 style="font-size: 13px; font-weight: 600; color: #111827; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 1px;">Company</h4>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
            <li><a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none;">About</a></li>
            <li><a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none;">Careers</a></li>
            <li><a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none;">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4 style="font-size: 13px; font-weight: 600; color: #111827; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 1px;">Connect</h4>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">
            <li><a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none;">Twitter</a></li>
            <li><a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none;">Dribbble</a></li>
            <li><a href="#" style="font-size: 14px; color: #6b7280; text-decoration: none;">LinkedIn</a></li>
          </ul>
        </div>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: center;">
        <p style="font-size: 13px; color: #9ca3af; margin: 0;">2026 Horizon Studio. All rights reserved.</p>
      </div>
    </div>
  </footer>

</body>
</html>`;
