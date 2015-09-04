This simple program does is two things:
- A filesystem watcher that takes files from a channel (from its storage folder), converts them (eventually), writes them to another directory that is publicly exposed through a web server.
- A Teamspeak 3 robot periodically changing the Banner GFX image. Image pool is defined by filesystem watcher.