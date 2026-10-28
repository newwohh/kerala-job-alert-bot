module.exports = {
  apps: [
    {
      name: "kerala-bot",
      script: "dist/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M"
    },
    {
      name: "sharjah-agent",
      script: "src/index.js",
      cwd: "sharjah-job-agent",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: {
        PORT: "3005"
      }
    }
  ]
};
