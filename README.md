## What is this

- chat with any of the top llms
- avoid subscription lock in
- pay by consumption
- own your data (don't really want openai to own my memory)

## Get started

1. Install Bun js runtime: https://bun.sh/docs/installation
2. Install and start Docker: https://docs.docker.com/get-docker/

3. Add environment variables as needed.

```bash
cd api
cp .env.example .env
# Update .env to have correct api keys
```

5. Install and run

```bash
./run.sh
```

Open the app at http://localhost:4001 and start chatting

## Demo

<video width="750" height="450" controls>
  <source src="./demo.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

## Keyboard shortcuts

- CMD + L = toggle model selector
- CMD + K = focus on keyboard
- CMD + H = go to history
- CMD + B = new chat
