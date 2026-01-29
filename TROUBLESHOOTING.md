# 🔧 Troubleshooting Guide

## Common Issues and Solutions

### 1. "Cannot find module '@game/shared'"

**Problem**: The shared package hasn't been built yet.

**Solution**:
```bash
cd shared
npm run build
```

Then restart your server/client.

---

### 2. Server won't start - "Port 3000 already in use"

**Problem**: Another process is using port 3000.

**Solution**:
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

---

### 3. Client shows "Connection error"

**Problem**: Can't connect to the server.

**Checklist**:
- ✅ Is the server running? Check Terminal 1
- ✅ Is it on port 3000? Check server logs
- ✅ Check browser console for specific errors
- ✅ Try refreshing the page

**Solution**:
```bash
# Restart the server
cd server
npm run dev
```

---

### 4. Players not syncing between windows

**Problem**: Multiplayer not working.

**Debug Steps**:
1. Open browser console in both windows
2. Look for "Connected to server: [socket-id]"
3. Check server terminal for "Player connected" messages

**Solution**:
- Make sure both windows are connected to the same server
- Check that Socket.IO is working: visit http://localhost:3000/health

---

### 5. TypeScript errors in IDE

**Problem**: Red squiggly lines everywhere.

**Solution**:
```bash
# Rebuild everything
cd shared && npm run build
cd ../server && npm run build
cd ../client && npm run build
```

Then restart your IDE/TypeScript server.

---

### 6. "EPERM: operation not permitted" during build

**Problem**: Permission issues with file system.

**Solution**:
```bash
# Clean and rebuild
rm -rf node_modules package-lock.json
rm -rf client/node_modules client/package-lock.json
rm -rf server/node_modules server/package-lock.json
rm -rf shared/node_modules shared/package-lock.json

npm install
```

---

### 7. Astro dev server won't start

**Problem**: Client build fails.

**Common Causes**:
- Missing dependencies
- Port 4321 in use

**Solution**:
```bash
cd client
rm -rf node_modules .astro dist
npm install
npm run dev
```

---

### 8. Players appear but don't move

**Problem**: Input not being sent to server.

**Debug**:
1. Open browser console
2. Press WASD keys
3. Check for Socket.IO events being emitted

**Solution**:
- Make sure you clicked on the game canvas
- Check browser console for JavaScript errors
- Verify server is receiving input (check server logs)

---

### 9. Game looks blurry/not pixelated

**Problem**: Browser scaling or CSS issues.

**Solution**:
- Check browser zoom is at 100%
- Clear browser cache and refresh
- Verify `pixelArt: true` in `client/src/game/main.ts`

---

### 10. Fly.io deployment fails

**Problem**: Docker build or deployment error.

**Common Issues**:
- Not logged in: `fly auth login`
- Wrong region: Edit `fly.toml`
- Build timeout: Increase resources in `fly.toml`

**Solution**:
```bash
# Check status
fly status

# View logs
fly logs

# Redeploy
fly deploy --verbose
```

---

## Development Tips

### Clean Slate
```bash
# Kill all processes
pkill -f "npm run dev"

# Clean all builds
rm -rf */dist */node_modules

# Reinstall
npm install
```

### Check What's Running
```bash
# Check ports
lsof -i :3000  # Server
lsof -i :4321  # Client

# Check processes
ps aux | grep node
```

### Force Refresh Browser
- **Chrome/Edge**: Ctrl+Shift+R (Cmd+Shift+R on Mac)
- **Firefox**: Ctrl+F5 (Cmd+Shift+R on Mac)
- **Safari**: Cmd+Option+R

### View Network Traffic
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "WS" (WebSocket)
4. Watch Socket.IO messages

---

## Still Having Issues?

### Check Versions
```bash
node --version  # Should be 20+
npm --version   # Should be 10+
```

### Verify File Structure
```bash
ls -R v1/
```

Should show:
- `client/src/game/`
- `server/src/`
- `shared/src/`

### Test Components Individually

**Test Server Only**:
```bash
cd server
npm run dev
# Visit http://localhost:3000/health
```

**Test Client Only**:
```bash
cd client
npm run dev
# Visit http://localhost:4321
```

---

## Getting Help

If you're still stuck:

1. **Check the logs**: Server terminal and browser console
2. **Read the error**: Often tells you exactly what's wrong
3. **Google the error**: Someone else has probably had it
4. **Check file permissions**: Make sure you can read/write files
5. **Try a clean install**: Delete everything and start fresh

---

## Quick Diagnostics Script

Run this to check your setup:

```bash
#!/bin/bash
echo "🔍 Diagnostics..."
echo ""
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo ""
echo "Checking ports..."
lsof -i :3000 && echo "⚠️  Port 3000 in use" || echo "✅ Port 3000 free"
lsof -i :4321 && echo "⚠️  Port 4321 in use" || echo "✅ Port 4321 free"
echo ""
echo "Checking builds..."
[ -d "shared/dist" ] && echo "✅ Shared built" || echo "❌ Shared not built"
[ -d "server/dist" ] && echo "✅ Server built" || echo "❌ Server not built"
[ -d "client/dist" ] && echo "✅ Client built" || echo "❌ Client not built"
```

Save as `diagnose.sh`, run `chmod +x diagnose.sh`, then `./diagnose.sh`
