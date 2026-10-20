import { DashboardStats } from "./stats.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderDashboardHtml(initialStats: DashboardStats): string {
  const statsJson = JSON.stringify(initialStats).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kerala Job Alert Bot — Analytics & Live Dashboard</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔔</text></svg>">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#eef2ff',
              100: '#e0e7ff',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca'
            }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .glass-card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(15, 23, 42, 0.5);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(100, 116, 139, 0.5);
      border-radius: 9999px;
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen custom-scrollbar antialiased">
  <!-- Top Navigation Bar -->
  <header class="sticky top-0 z-50 glass-card border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20">
          🔔
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Kerala Job Alert Bot
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Live Analytics</span>
          </h1>
          <p class="text-xs text-slate-400" id="bot-subtext">Connected to Telegram & MongoDB</p>
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <!-- Live status indicators -->
        <div class="hidden sm:flex items-center space-x-2 text-xs">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span id="header-polling-status">Bot Active</span>
          </span>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            <span class="text-slate-400">Uptime:</span>
            <span id="header-uptime" class="font-medium">--</span>
          </span>
        </div>

        <!-- Auto refresh toggle -->
        <label class="flex items-center cursor-pointer text-xs text-slate-400 hover:text-slate-200 select-none space-x-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <input type="checkbox" id="auto-refresh-toggle" checked class="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0">
          <span>Auto-refresh (30s)</span>
        </label>

        <!-- Refresh button -->
        <button id="refresh-btn" onclick="fetchLatestStats()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95">
          <svg id="refresh-icon" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content Container -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
    <!-- Notice Banner (if any error) -->
    <div id="error-banner" class="hidden rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
      <div class="flex items-center gap-3">
        <svg class="h-5 w-5 text-rose-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        <span id="error-message"></span>
      </div>
    </div>

    <!-- KPI Metric Cards Grid -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <!-- Card 1: Channel Audience (Telegram API) -->
      <div class="glass-card rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Community Audience</span>
          <span class="p-2 rounded-xl bg-sky-500/10 text-sky-400">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </span>
        </div>
        <div class="mt-4 flex items-baseline gap-2">
          <div id="stat-channel-members" class="text-3xl font-extrabold text-white">--</div>
          <span class="text-xs text-sky-400 font-medium">members</span>
        </div>
        <div class="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span id="stat-channel-name" class="truncate max-w-[140px]">Telegram Group</span>
          <span class="text-slate-500 text-[10px]">Live Telegram</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-500 opacity-60"></div>
      </div>

      <!-- Card 2: Tracked Users & Joins (MongoDB) -->
      <div class="glass-card rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Tracked Users</span>
          <span class="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
          </span>
        </div>
        <div class="mt-4 flex items-baseline gap-2">
          <div id="stat-total-users" class="text-3xl font-extrabold text-white">--</div>
          <span id="stat-joins-24h" class="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-semibold border border-purple-500/20">+0 in 24h</span>
        </div>
        <div class="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span id="stat-active-users">-- active</span>
          <span class="text-slate-500 text-[10px]">MongoDB</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-60"></div>
      </div>

      <!-- Card 3: Total Scraped Jobs (MongoDB) -->
      <div class="glass-card rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Scraped Jobs</span>
          <span class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </span>
        </div>
        <div class="mt-4 flex items-baseline gap-2">
          <div id="stat-total-jobs" class="text-3xl font-extrabold text-white">--</div>
          <span id="stat-jobs-24h" class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">+0 in 24h</span>
        </div>
        <div class="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>Infopark + Technopark</span>
          <span class="text-slate-500 text-[10px]">MongoDB</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-60"></div>
      </div>

      <!-- Card 4: Keyword Subscribers (MongoDB) -->
      <div class="glass-card rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Alert Subscribers</span>
          <span class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
          </span>
        </div>
        <div class="mt-4 flex items-baseline gap-2">
          <div id="stat-total-subs" class="text-3xl font-extrabold text-white">--</div>
          <span class="text-xs text-indigo-400 font-medium">alert users</span>
        </div>
        <div class="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span id="stat-total-keywords">-- keywords</span>
          <span class="text-slate-500 text-[10px]">MongoDB</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-60"></div>
      </div>

      <!-- Card 5: DM Alerts Delivered (MongoDB) -->
      <div class="glass-card rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">DM Alerts Sent</span>
          <span class="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          </span>
        </div>
        <div class="mt-4 flex items-baseline gap-2">
          <div id="stat-alerts-delivered" class="text-3xl font-extrabold text-white">--</div>
          <span id="stat-alerts-24h" class="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">+0 in 24h</span>
        </div>
        <div class="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>Personal matches</span>
          <span class="text-slate-500 text-[10px]">MongoDB</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-60"></div>
      </div>
    </section>
        <div class="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>Personal matches</span>
          <span class="text-slate-500 text-[10px]">MongoDB</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-60"></div>
      </div>
    </section>

    <!-- Charts Row 1: Activity Timeline & Jobs By Source -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 14-Day User Activity Timeline -->
      <div class="glass-card rounded-2xl p-6 lg:col-span-2">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-semibold text-white">User Activity & Interaction Trend</h2>
            <p class="text-xs text-slate-400">Daily events (commands, search queries, button clicks) over the last 14 days</p>
          </div>
          <span class="text-xs text-slate-500 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">14 Days</span>
        </div>
        <div class="h-64">
          <canvas id="activityChart"></canvas>
        </div>
      </div>

      <!-- Jobs Breakdown By Scraper Source -->
      <div class="glass-card rounded-2xl p-6 flex flex-col justify-between">
        <div>
          <h2 class="text-base font-semibold text-white mb-1">Jobs by Source</h2>
          <p class="text-xs text-slate-400 mb-4">Distribution across supported tech parks</p>
          <div class="h-52 relative flex items-center justify-center">
            <canvas id="sourcesChart"></canvas>
          </div>
        </div>
        <div id="sources-legend" class="mt-4 space-y-2 text-xs">
          <!-- Dynamically populated -->
        </div>
      </div>
    </section>

    <!-- Charts Row 2: Top Keywords & Commands/Clicks -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Top Subscribed Keywords -->
      <div class="glass-card rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-semibold text-white">Top Alert Keywords</h2>
            <p class="text-xs text-slate-400">Most requested tech stacks & roles by job seekers</p>
          </div>
          <span class="text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20 font-medium">Subscriptions</span>
        </div>
        <div class="h-64">
          <canvas id="keywordsChart"></canvas>
        </div>
      </div>

      <!-- Commands & UI Clicks Breakdown -->
      <div class="glass-card rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-semibold text-white">Bot Commands & UI Interactions</h2>
            <p class="text-xs text-slate-400">Frequency of user actions and interactive keyboard buttons</p>
          </div>
          <span class="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 font-medium">Usage</span>
        </div>
        <div class="h-64">
          <canvas id="commandsChart"></canvas>
        </div>
      </div>
    </section>

    <!-- Tables Row: Recent Jobs & Top Hiring Companies -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Recent Jobs Table (2 cols) -->
      <div class="glass-card rounded-2xl p-6 lg:col-span-2 flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-semibold text-white">Latest Scraped Jobs</h2>
            <p class="text-xs text-slate-400">Recently indexed postings from Kerala tech hubs</p>
          </div>
          <a href="/api/stats" target="_blank" class="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1">
            <span>Raw JSON</span>
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
        <div class="overflow-x-auto custom-scrollbar flex-1">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="text-slate-400 uppercase bg-slate-900/60 border-b border-slate-800">
              <tr>
                <th scope="col" class="py-2.5 px-3">Job Title</th>
                <th scope="col" class="py-2.5 px-3">Company</th>
                <th scope="col" class="py-2.5 px-3">Source</th>
                <th scope="col" class="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="recent-jobs-tbody" class="divide-y divide-slate-800/60">
              <!-- Dynamically populated -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top Hiring Companies (1 col) -->
      <div class="glass-card rounded-2xl p-6 flex flex-col">
        <h2 class="text-base font-semibold text-white mb-1">Top Hiring Companies</h2>
        <p class="text-xs text-slate-400 mb-4">Companies with the highest job openings</p>
        <div class="overflow-x-auto custom-scrollbar flex-1">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="text-slate-400 uppercase bg-slate-900/60 border-b border-slate-800">
              <tr>
                <th scope="col" class="py-2.5 px-2">#</th>
                <th scope="col" class="py-2.5 px-3">Company</th>
                <th scope="col" class="py-2.5 px-3 text-right">Openings</th>
              </tr>
            </thead>
            <tbody id="top-companies-tbody" class="divide-y divide-slate-800/60">
              <!-- Dynamically populated -->
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Community & Member Activity Feed -->
    <section class="glass-card rounded-2xl p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base font-semibold text-white">Community & Member Activity Feed</h2>
          <p class="text-xs text-slate-400">Real-time log of members joining, leaving, or interacting with the community</p>
        </div>
        <span class="text-xs text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-500/20 font-medium">Real-Time Telegram</span>
      </div>
      <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-xs text-slate-300">
          <thead class="text-slate-400 uppercase bg-slate-900/60 border-b border-slate-800">
            <tr>
              <th scope="col" class="py-2.5 px-3">User</th>
              <th scope="col" class="py-2.5 px-3">Action</th>
              <th scope="col" class="py-2.5 px-3">Invite Link / Source</th>
              <th scope="col" class="py-2.5 px-3 text-right">Event Time</th>
            </tr>
          </thead>
          <tbody id="recent-members-tbody" class="divide-y divide-slate-800/60">
            <!-- Dynamically populated -->
          </tbody>
        </table>
      </div>
    </section>

    <!-- System Telemetry & Bot Configuration Details -->
    <section class="glass-card rounded-2xl p-6">
      <h2 class="text-base font-semibold text-white mb-4">System Telemetry & Bot Information</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block mb-1">Bot Username</span>
          <span id="sys-bot-user" class="font-semibold text-white">--</span>
        </div>
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block mb-1">Channel ID</span>
          <span id="sys-channel-id" class="font-semibold text-white truncate block">--</span>
        </div>
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block mb-1">Cron Schedule</span>
          <span id="sys-cron" class="font-semibold text-emerald-400">--</span>
        </div>
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block mb-1">Node Runtime</span>
          <span id="sys-node" class="font-semibold text-white">--</span>
        </div>
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block mb-1">Memory (RSS / Heap)</span>
          <span id="sys-mem" class="font-semibold text-white">--</span>
        </div>
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span class="text-slate-500 block mb-1">Last Updated</span>
          <span id="sys-updated" class="font-semibold text-slate-300">--</span>
        </div>
      </div>
    </section>
  </main>

  <!-- Client-side Logic & Chart Initialization -->
  <script>
    let rawStats = ${statsJson};
    let activityChartInstance = null;
    let sourcesChartInstance = null;
    let keywordsChartInstance = null;
    let commandsChartInstance = null;

    function formatNumber(num) {
      if (typeof num !== 'number') return '--';
      return new Intl.NumberFormat().format(num);
    }

    function escapeText(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function updateUi(data) {
      if (!data) return;

      // Header
      document.getElementById('header-uptime').textContent = data.system?.uptimeFormatted || '--';
      const isPolling = data.telegram?.bot?.isPolling;
      document.getElementById('header-polling-status').textContent = isPolling ? 'Bot Polling Active' : 'Polling Idle';
      document.getElementById('bot-subtext').textContent = data.telegram?.bot?.username
        ? '@' + data.telegram.bot.username + ' • Channel: ' + (data.telegram?.channel?.title || data.telegram?.channel?.id || 'Connected')
        : 'Kerala Job Alert Bot';

      // KPI 1: Channel Members
      const members = data.telegram?.channel?.memberCount;
      document.getElementById('stat-channel-members').textContent = members !== null && members !== undefined ? formatNumber(members) : 'N/A';
      document.getElementById('stat-channel-name').textContent = data.telegram?.channel?.title || ('Channel ' + (data.telegram?.channel?.id || ''));

      // KPI 2: Tracked Users
      document.getElementById('stat-total-users').textContent = formatNumber(data.users?.totalUsers);
      document.getElementById('stat-joins-24h').textContent = '+' + (data.users?.joined24h || 0) + ' in 24h';
      document.getElementById('stat-active-users').textContent = (data.users?.activeUsers || 0) + ' active members';

      // KPI 3: Total Jobs
      document.getElementById('stat-total-jobs').textContent = formatNumber(data.jobs?.total);
      document.getElementById('stat-jobs-24h').textContent = '+' + (data.jobs?.addedLast24h || 0) + ' in 24h';

      // KPI 4: Alert Subscribers
      document.getElementById('stat-total-subs').textContent = formatNumber(data.subscriptions?.totalSubscribers);
      document.getElementById('stat-total-keywords').textContent = (data.subscriptions?.totalKeywords || 0) + ' active keywords';

      // KPI 5: DM Alerts
      document.getElementById('stat-alerts-delivered').textContent = formatNumber(data.notifications?.totalDelivered);
      document.getElementById('stat-alerts-24h').textContent = '+' + (data.notifications?.deliveredLast24h || 0) + ' in 24h';

      // Telemetry
      document.getElementById('sys-bot-user').textContent = data.telegram?.bot?.username ? '@' + data.telegram.bot.username : (data.telegram?.bot?.firstName || 'Connected');
      document.getElementById('sys-channel-id').textContent = data.telegram?.channel?.id || '--';
      document.getElementById('sys-cron').textContent = data.system?.cron?.schedule + (data.system?.cron?.enabled ? ' (active)' : ' (paused)');
      document.getElementById('sys-node').textContent = data.system?.nodeVersion || '--';
      document.getElementById('sys-mem').textContent = (data.system?.memoryMb?.rss || 0) + 'MB / ' + (data.system?.memoryMb?.heapUsed || 0) + 'MB';
      document.getElementById('sys-updated').textContent = new Date(data.timestamp).toLocaleTimeString();

      // Error Banner
      const errorBanner = document.getElementById('error-banner');
      if (data.telegram?.error) {
        errorBanner.classList.remove('hidden');
        document.getElementById('error-message').textContent = data.telegram.error;
      } else {
        errorBanner.classList.add('hidden');
      }

      // Recent Jobs Table
      const jobsTbody = document.getElementById('recent-jobs-tbody');
      if (data.jobs?.recent && data.jobs.recent.length > 0) {
        jobsTbody.innerHTML = data.jobs.recent.map(job => \`
          <tr class="hover:bg-slate-900/40 transition">
            <td class="py-3 px-3 font-medium text-slate-100 max-w-[200px] truncate" title="\${escapeText(job.title)}">
              \${escapeText(job.title)}
            </td>
            <td class="py-3 px-3 text-slate-300 max-w-[150px] truncate" title="\${escapeText(job.company)}">
              \${escapeText(job.company)}
            </td>
            <td class="py-3 px-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                \${escapeText(job.source)}
              </span>
            </td>
            <td class="py-3 px-3 text-right">
              <a href="\${escapeText(job.link)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold transition">
                <span>Apply</span>
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </td>
          </tr>
        \`).join('');
      } else {
        jobsTbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500">No jobs scraped yet. Run the scraper or wait for cron.</td></tr>';
      }

      // Top Companies Table
      const compTbody = document.getElementById('top-companies-tbody');
      if (data.jobs?.topCompanies && data.jobs.topCompanies.length > 0) {
        compTbody.innerHTML = data.jobs.topCompanies.map((c, idx) => \`
          <tr class="hover:bg-slate-900/40 transition">
            <td class="py-2.5 px-2 font-mono text-slate-500 text-[11px]">\${idx + 1}</td>
            <td class="py-2.5 px-3 font-medium text-slate-200 max-w-[120px] truncate" title="\${escapeText(c.company)}">
              \${escapeText(c.company)}
            </td>
            <td class="py-2.5 px-3 text-right font-semibold text-emerald-400">
              \${c.count}
            </td>
          </tr>
        \`).join('');
      } else {
        compTbody.innerHTML = '<tr><td colspan="3" class="py-6 text-center text-slate-500">No companies recorded.</td></tr>';
      }

      // Recent Member Activity Table
      const membersTbody = document.getElementById('recent-members-tbody');
      if (data.users?.recentEvents && data.users.recentEvents.length > 0) {
        membersTbody.innerHTML = data.users.recentEvents.map(evt => {
          const actionColors = {
            joined: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            left: 'bg-slate-800 text-slate-400 border-slate-700',
            blocked: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
            unblocked: 'bg-teal-500/10 text-teal-400 border-teal-500/20'
          };
          const badgeClass = actionColors[evt.action] || 'bg-slate-800 text-slate-300 border-slate-700';
          const userName = evt.username ? '@' + evt.username : (evt.firstName || ('User ' + evt.userId));
          return \`
            <tr class="hover:bg-slate-900/40 transition">
              <td class="py-3 px-3 font-medium text-slate-100 flex items-center gap-2">
                <span class="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                  \${escapeText(userName.slice(0, 2).toUpperCase())}
                </span>
                <span class="truncate max-w-[180px]">\${escapeText(userName)}</span>
              </td>
              <td class="py-3 px-3">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border \${badgeClass}">
                  \${escapeText(evt.action)}
                </span>
              </td>
              <td class="py-3 px-3 text-slate-400">
                \${evt.inviteLink ? \`<span class="truncate block max-w-[200px] text-indigo-400 font-mono text-[11px]">\${escapeText(evt.inviteLink)}</span>\` : '<span class="text-slate-500">Direct / Organic</span>'}
              </td>
              <td class="py-3 px-3 text-right text-slate-400 font-mono text-[11px]">
                \${new Date(evt.createdAt).toLocaleString()}
              </td>
            </tr>
          \`;
        }).join('');
      } else {
        membersTbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500">No member events recorded yet. New joins will appear here in real-time.</td></tr>';
      }

      // Render / Update Charts
      renderCharts(data);
    }

    function renderCharts(data) {
      // 1. Activity Chart (14-Day Timeline)
      const activityCtx = document.getElementById('activityChart').getContext('2d');
      const daily = data.analytics?.dailyActivity || [];
      const labels = daily.map(d => d.date.slice(5)); // e.g. "10-18"
      const counts = daily.map(d => d.count);

      if (activityChartInstance) {
        activityChartInstance.data.labels = labels;
        activityChartInstance.data.datasets[0].data = counts;
        activityChartInstance.update();
      } else {
        const gradient = activityCtx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        activityChartInstance = new Chart(activityCtx, {
          type: 'line',
          data: {
            labels: labels.length ? labels : ['Today'],
            datasets: [{
              label: 'Events & Interactions',
              data: counts.length ? counts : [0],
              borderColor: '#6366f1',
              backgroundColor: gradient,
              fill: true,
              tension: 0.35,
              borderWidth: 2,
              pointBackgroundColor: '#6366f1',
              pointRadius: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { backgroundColor: '#1e293b', titleColor: '#fff', bodyColor: '#cbd5e1' }
            },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8' } },
              y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', precision: 0 }, beginAtZero: true }
            }
          }
        });
      }

      // 2. Jobs Sources Doughnut Chart
      const sourcesCtx = document.getElementById('sourcesChart').getContext('2d');
      const sources = data.jobs?.bySource || [];
      const srcLabels = sources.map(s => s.source);
      const srcCounts = sources.map(s => s.count);
      const srcColors = ['#10b981', '#6366f1', '#06b6d4', '#f59e0b', '#ec4899'];

      if (sourcesChartInstance) {
        sourcesChartInstance.data.labels = srcLabels;
        sourcesChartInstance.data.datasets[0].data = srcCounts;
        sourcesChartInstance.update();
      } else {
        sourcesChartInstance = new Chart(sourcesCtx, {
          type: 'doughnut',
          data: {
            labels: srcLabels.length ? srcLabels : ['None'],
            datasets: [{
              data: srcCounts.length ? srcCounts : [1],
              backgroundColor: srcColors.slice(0, Math.max(srcLabels.length, 1)),
              borderColor: '#0f172a',
              borderWidth: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            cutout: '72%'
          }
        });
      }

      // Sources Legend
      const legendEl = document.getElementById('sources-legend');
      legendEl.innerHTML = sources.map((s, i) => \`
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: \${srcColors[i % srcColors.length]}"></span>
            <span class="text-slate-300 font-medium">\${escapeText(s.source)}</span>
          </div>
          <span class="font-semibold text-slate-100">\${formatNumber(s.count)}</span>
        </div>
      \`).join('');

      // 3. Top Keywords Chart
      const keywordsCtx = document.getElementById('keywordsChart').getContext('2d');
      const topKeywords = (data.subscriptions?.topKeywords || []).slice(0, 8);
      const kwLabels = topKeywords.map(k => k.keyword);
      const kwCounts = topKeywords.map(k => k.count);

      if (keywordsChartInstance) {
        keywordsChartInstance.data.labels = kwLabels;
        keywordsChartInstance.data.datasets[0].data = kwCounts;
        keywordsChartInstance.update();
      } else {
        keywordsChartInstance = new Chart(keywordsCtx, {
          type: 'bar',
          data: {
            labels: kwLabels.length ? kwLabels : ['(No keywords yet)'],
            datasets: [{
              label: 'Subscribers',
              data: kwCounts.length ? kwCounts : [0],
              backgroundColor: '#4f46e5',
              borderRadius: 6
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { backgroundColor: '#1e293b' }
            },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', precision: 0 }, beginAtZero: true },
              y: { grid: { display: false }, ticks: { color: '#e2e8f0' } }
            }
          }
        });
      }

      // 4. Commands & UI Clicks Chart
      const commandsCtx = document.getElementById('commandsChart').getContext('2d');
      const topCommands = (data.analytics?.topCommands || []).slice(0, 5);
      const topClicks = (data.analytics?.topClicks || []).slice(0, 5);
      const actionLabels = [...topCommands.map(c => c.command), ...topClicks.map(k => k.action.replace('cmd:', 'btn:'))];
      const actionCounts = [...topCommands.map(c => c.count), ...topClicks.map(k => k.count)];

      if (commandsChartInstance) {
        commandsChartInstance.data.labels = actionLabels;
        commandsChartInstance.data.datasets[0].data = actionCounts;
        commandsChartInstance.update();
      } else {
        commandsChartInstance = new Chart(commandsCtx, {
          type: 'bar',
          data: {
            labels: actionLabels.length ? actionLabels : ['None'],
            datasets: [{
              label: 'Invocations',
              data: actionCounts.length ? actionCounts : [0],
              backgroundColor: '#10b981',
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { backgroundColor: '#1e293b' }
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#e2e8f0' } },
              y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', precision: 0 }, beginAtZero: true }
            }
          }
        });
      }
    }

    async function fetchLatestStats() {
      const refreshBtn = document.getElementById('refresh-btn');
      const refreshIcon = document.getElementById('refresh-icon');
      refreshIcon.classList.add('animate-spin');

      try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        rawStats = data;
        updateUi(data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setTimeout(() => refreshIcon.classList.remove('animate-spin'), 400);
      }
    }

    // Auto-refresh interval (30s)
    let autoRefreshTimer = setInterval(() => {
      const isAuto = document.getElementById('auto-refresh-toggle').checked;
      if (isAuto) fetchLatestStats();
    }, 30000);

    // Initial render
    document.addEventListener('DOMContentLoaded', () => {
      updateUi(rawStats);
    });
  </script>
</body>
</html>`;
}
