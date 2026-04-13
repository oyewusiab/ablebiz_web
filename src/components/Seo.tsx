import { Helmet } from "react-helmet-async";
import { site } from "../content/site";

export function Seo({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path?: string;
}) {
  const fullTitle = `${title} | ${site.name}`;
  const canonical = path ? `${window.location.origin}${path}` : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonical ? <link rel="canonical" href={canonical} /> : null}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
    </Helmet>
  );
}
