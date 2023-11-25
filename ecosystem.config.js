module.exports = {
  apps : [
  {
    name: 'Rotomonitor',
    script: 'Rotomonitor.js',
    cwd: '/home/user/Rotomonitor/',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    out_file: 'NULL'
  }
  ]
};
