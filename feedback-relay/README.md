# Feedback relay

Visitors without a GitHub account send feedback through the form of `feedback.js`. It goes to `Code.gs`, a Google
Apps Script web app that keeps each message for a few hours. The GitHub Action `.github/workflows/feedback.yml`
fetches new messages every 10 minutes and opens one issue each, with GitHub's own token for that run. No personal
token is stored anywhere. Issues appear as opened by `github-actions[bot]`, with the labels `feedback` and `via form`,
usually 10 to 20 minutes after sending.

## Set up (once)

1. On script.google.com: New project, paste `Code.gs`, save.
2. Deploy → New deployment → Web app; Execute as: Me; Who has access: Anyone. Copy the web app address (`…/exec`).
3. Put that address into `RELAY_DEFAULT` in `feedback.js` and `RELAY_URL` in `.github/workflows/feedback.yml`, and
   publish both.

## Run it

- Pause the form: script property `ENABLED` = `no` (the page then points to GitHub). Stop: archive the deployment, or
  disable the workflow under Actions.
- Limits: 20 messages per hour and 100 per day in all; a hidden field and a minimum time keep simple bots out.
  Visitor text goes into the issue as plain text (code blocks), so it cannot add links, images or @mentions.
- Opening the web app address shows whether the relay runs and how many messages wait; `?pending=1` lists them
  (they become public issues anyway). Anyone could also remove a waiting message with `?done=<id>`; for a
  hackathon that is accepted.
- Close unwanted issues rather than deleting them: a deleted one could come back while its message is still kept
  (up to 6 hours).
