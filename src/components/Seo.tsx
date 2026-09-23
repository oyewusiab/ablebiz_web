import { Helmet } from "react-helmet-async";
import { site } from "../content/site";

export function Seo({
  title,
  description,
  path,
  keywords,
  schema,
}: {
  title: string;
  description: string;
  path?: string;
  keywords?: string | string[];
  schema?: Record<string, unknown>;
}) {
  const fullTitle = title.includes("ABLEBIZ") ? title : `${title} | ${site.name}`;
  const canonical = path
    ? typeof window !== "undefined"
      ? `${window.location.origin}${path}`
      : `https://www.ablebiz.com.ng${path}`
    : undefined;

  const keywordsString = Array.isArray(keywords)
    ? keywords.join(", ")
    : keywords;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywordsString ? <meta name="keywords" content={keywordsString} /> : null}
      {canonical ? <link rel="canonical" href={canonical} /> : null}

      <meta property="og:site_name" content={site.name} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      <meta property="og:image" content="https://www.ablebiz.com.ng/images/ablebiz-logo.png" />
      <meta property="og:locale" content="en_NG" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content="https://www.ablebiz.com.ng/images/ablebiz-logo.png" />

      {schema ? (
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      ) : null}
    </Helmet>
  );
}
