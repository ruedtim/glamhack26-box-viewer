# Feedback relay

Visitors without a GitHub account send feedback through the form of `feedback.js`. It goes to a Google Apps Script
web app, the relay, which keeps each message for up to 48 hours. The GitHub Action `.github/workflows/feedback.yml`
fetches new messages every 10 minutes and opens one issue each, with GitHub's own token for that run. No personal
token is stored anywhere. Issues appear as opened by `github-actions[bot]`, with the labels `feedback` and
`via form`.

**The relay is shared** with the similar-search site of the same team. Its code is maintained there:
[ruedtim/glamhack26-similar-search, `feedback-relay/Code.gs`](https://github.com/ruedtim/glamhack26-similar-search/blob/main/feedback-relay/Code.gs)
(deployed as version 3 or later of the same web app, so the address in `feedback.js` and the workflow is unchanged).
This site's form and Action send no `site` parameter and therefore count as `box-viewer` there.

## Run it

- Pause this site's form: script property `ENABLED_box-viewer` = `no` (`ENABLED` = `no` pauses all sites); the page
  then points to GitHub. Stop the issues: disable the workflow under Actions.
- Limits per site: 20 messages per hour and 100 per day; a hidden field and a minimum time keep simple bots out.
  Visitor text goes into the issue as plain text (code blocks), so it cannot add links, images or @mentions.
- Opening the web app address shows, per site, how many messages wait and how old the oldest is. A large age means
  the Action has not run: GitHub's timer can lag by hours, so start it by hand under Actions → Run workflow.
- Close unwanted issues rather than deleting them: a deleted one could come back while its message is still kept.
