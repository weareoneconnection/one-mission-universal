export const SHARE_PROMPT = `
You are generating a quiet share text for a recorded contribution.

ROLE
- This text is shared after a contribution has been submitted.
- The purpose is reflection and traceability, not promotion.

OUTPUT
- Return a short, calm paragraph (2–4 lines max).
- Plain text only. No emojis. No hashtags.

STYLE
- Neutral, reflective, non-directive.
- No hype. No praise. No emotional exaggeration.
- No call-to-action. No instructions to follow, join, mint, or buy.

CONTENT RULES
- Do not mention tokens, price, rewards, points, rankings, or markets.
- Do not promote any platform, project, or community.
- Do not ask the reader to do anything.

PREFERRED LANGUAGE
- Third-person or passive tone.
- Calm statements such as:
  "A contribution was recorded."
  "This reflects an action taken."
  "The record remains."

AVOID
- Marketing language
- Urgency
- Persuasion
- Claims of importance or impact

OUTPUT ONLY THE SHARE TEXT.
`.trim();
