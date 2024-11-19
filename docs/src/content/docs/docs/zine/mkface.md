---
title: Making Faces Zine Discussion
description: A companion to the "Making Faces with finite-choice logic programming" bonus-content zine.
---

A companion page to the companion zine to [Dusa Zine #1](https://ko-fi.com/s/3ca6bcf73e)

### Q1

There actually aren't clear rules for what goes in the crossed-out boxes: you could reasonably draw nothing, or just a circle, or a circle with a smile, or a circle with a smile and spiral overlapping. There's only one consistent way to fill out the other boxes:

```
Top row: 
  square-smiley
  circle-smiley? (crossed out)
  circle-spiral

Bottom row:
  square
  circle
  smiley
```

The bottom row needs to contain three shapes: the circle, the square, and the smiley. The circle and square are incompatible, so they have to go in the boxes to the left and the smiley has to go in the box to the right.

Looking at the connections, the top-right box _doesn't_ contain a line from the smiley, so it must be the circle-with-spiral, which means that the circle must go in the middle of the bottom row.

There are two solutions for this program, the two not-crossed-out faces on the top row.

[Explore this example on dusa.rocks](https://dusa.rocks/#jsonz=RYyxDsIwDAV_5cmsoVLXLiz8ACvKYqVGWErdEJMBVfl3qJBgvTvdRk-aaC1iFGheU1vEdnLAuTnjqiYYOeAyRovmdy4CdWxIWlOWAH80roI-RLtx2uUJvmiW1598ci9aOaNjOuJ3-T4G6m8)

### Q2

Changing the `shape` from a closed rule to two open rules didn't make any difference, since there's no other rules that have different ideas about what shapes should exist.

Changing the first `face` rule from an open rule to a closed rule means that, whenever the shape is a circle, the rules are forcing the face to have two different values, which isn't allowed.

Again, there aren't totally formal rules for what needs to be crossed out, but your diagram should have four not-crossed-out faces, and the not-crossed-out part of your drawing should include all the faces and connections from Q1 _except_ for the circle-with-face in the upper-right.

[Explore this example on dusa.rocks](https://dusa.rocks/#jsonz=XcyxCsIwEIfxV_lzrrGgY2dfwFWyHOkVD9JrzJlBSt5dROng-vvg2-hJI61FjAJNa2qL2EcOuDRn3NQEJw64nqNF8zsXgTo2JK0pS4A_GldBH6LNnH7RF83y-seilTM6xiP20XczUH8D)

### Q3

CORRECTION: there should be an incompatibility symbol between the two blanks in the top row. This is missing in some editions.

There are multiple possible solutions! The only real constraint is that incompatibility lines always connect a smiley face and a spiral face. Here's one solution:

```
Top row:
  glowing circle smiley
  glowing circle spiral

Middle row:
  glowing smiley
  glowing spiral
  circle smiley
  circle spiral
  glowing circle

Bottom row:
  smiley
  spiral
  glowing
  circle
```

[Explore this example on dusa.rocks](https://dusa.rocks/#jsonz=JYqxCsMwDAV_5aGuJlC6denSH8havAhHTQWObKKGEkL-PTHdjrvb6Et3KlWMAg0lLZNYMxc8F2e81ARXDuhv0aK9OQnUscEnzbIGeNWZM_Yumn-4tvpA0jllOdWYy-__N1Ibz5H2Aw)

### Q4

```
shape is { 𖧋, □, ☆ }
glow is { ✨ }
face is { ツ } :- 𖧋
```

The incompatibility signals indicate that the star shape is incompatible with the square shape, so the star must be one of the shapes, not a glow or a face.

The glow property works the same way in this example as it did in Q3.

According to the drawing, we only can add a smiley when there's a circle, so the premise of the last rule must be "𖧋".

Using proper Dusa syntax, the program looks like this:

```
shape is { star, square, circle }.
glow is { glowing }.
face is { smiley } :- shape is circle.
```

[Explore this example on dusa.rocks](https://dusa.rocks/#jsonz=PYxBCoMwEEWv8pluU6HgynUv0G3JZkhHG4gTmzG4EO9eVNrd5_HfW2mmjvIkSo5eOdRRdCcX3KsxnlEFN3Z4tF692psnQTSssJmLg30qF3EIsYQk2BqvQ8rLedlX1OGgPYefOMZ0UHRX_INnoKHtCw)