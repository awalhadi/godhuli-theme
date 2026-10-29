---
title: Godhuli preview
tags: [theme, markdown]
---

# Heading one — ember, bold

## Heading two

### Heading three steps down to teal

Body text with **bold**, _italic_, ***both***, ~~struck~~, and `inline code`.
Raw markdown punctuation (`#`, `**`, `[]()`) should stay dim.

> A quote recedes to muted italic, with an ember marker.

- list markers carry the accent
- [ ] task item
- [x] done item

1. Ordered
2. Items

[Link text](https://example.com "title") and a reference [docs][1].

| Role    | Visibility |
| ------- | ---------- |
| comment | receding   |
| string  | clear      |

```ts
const greeting = `hello ${name}`; // fenced code keeps full syntax colors
```

---

[1]: https://code.visualstudio.com/api/extension-guides/color-theme
