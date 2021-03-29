import * as React from "react";
import SEO from "../seo.json";
import { Helmet } from "react-helmet";

const Seo = () => (
  <Helmet>
    <title>{SEO.title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Glitch: React Starter</title>

    <meta
      name="description"
      content={SEO.description}
    />
    <meta name="robots" content="index,follow" />

    <link rel="canonical" href="https://glitch-hello-react.glitch.me/" />

    <meta property="og:title" content="Hello React!" />
    <meta property="og:type" content="article" />

    <meta property="og:url" content="https://glitch-hello-react.glitch.me/" />
    <meta
      property="og:description"
      content="A simple React site, built with Glitch. Remix it to get your own."
    />
    <meta
      property="og:image"
      content={SEO.image}
    />

    <meta name="twitter:card" content="summary" />

    <meta name="twitter:url" content="https://glitch-hello-react.glitch.me/" />
    <meta name="twitter:title" content="Hello React!" />
    <meta
      name="twitter:description"
      content="A simple React site, built with Glitch. Remix it to get your own."
    />
    <meta
      name="twitter:image"
      content="https://cdn.glitch.com/605e2a51-d45f-4d87-a285-9410ad350515%2Fhello-react-social.png?v=1616712748355"
    />
  </Helmet>
);

export default Seo;
