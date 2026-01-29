# 🚀 Quick Start Guide

## Get Started in 2 Minutes!

### 1. Start the Server (Terminal 1)

```bash
cd server
npm run dev
```

You should see:
```
🎮 Game server running on port 3000
📊 Tick rate: 60 Hz
```

### 2. Start the Client (Terminal 2)

```bash
cd client
npm run dev
```

You should see:
```
🚀 astro dev
Local: http://localhost:4321/
```

### 3. Test Multiplayer!

1. Open **http://localhost:4321** in your first browser window
2. Open **http://localhost:4321** in a second browser window (or use a different browser)
3. Move around with **WASD** or **Arrow Keys**
4. Watch the players sync in real-time! 🎮

## Troubleshooting

### Server won't start?
- Make sure you're in the `server` directory
- Check if port 3000 is already in use
- Try: `lsof -ti:3000 | xargs kill -9` to free the port

### Client won't connect?
- Make sure the server is running first
- Check the browser console for errors
- Verify you see "Connected!" in the game

### Build errors?
- Run `cd shared && npm run build` first
- Then try starting server/client again

## Development Tips

### Multiple Players Testing
- Use different browsers (Chrome + Firefox)
- Use incognito/private windows
- Use different browser profiles

### Hot Reload
- Client: Automatically reloads on file changes
- Server: Automatically restarts on file changes (via tsx watch)

### Checking Server Health
Visit: http://localhost:3000/health

## Next Steps

1. **Customize Colors**: Edit `shared/src/types.ts` → `GAME_CONFIG.COLORS`
2. **Change World Size**: Edit `WORLD_WIDTH` and `WORLD_HEIGHT` in the same file
3. **Adjust Player Speed**: Modify `PLAYER_SPEED` constant
4. **Add Features**: Check out the TODO section in README.md

## Deploy to Fly.io

When ready to deploy:

```bash
# First time
fly launch

# Subsequent deploys
fly deploy
```

## Need Help?

Check the main [README.md](README.md) for full documentation!
