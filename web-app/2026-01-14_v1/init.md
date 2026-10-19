# Task

Create a standalone html/javascript/css app that does the following:

- Accepts user text input
- Tokenizes the text input, maps each token to a random HEX color code.
    - Option to use "standard" mapping OR "random" (standard needs to be created, should be able to handle ALL word input.)
    - IMPORTANT: In either random or standard mode the colors MUST be unique per token, any repeated tokens should use the same color.
- Live during input maps the colors in a square canvas. Appending each token/color in a square pixel block. (The pixel square size should be adjustable.)
    - Button to re-randomize the color mapping.
- Outputs
    - Ability to export a high-res image.
    - download what the color mapping is (json)