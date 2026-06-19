import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

interface PageSEOProps {
  title: string;
  description?: string;
  /** Override the canonical/og:url path. Defaults to the current route. */
  path?: string;
}

const SITE_URL = "https://maxaisocialsandbox.lovable.app";
const BRAND = "Maximum Social";

export function PageSEO({ title, description, path }: PageSEOProps) {
  const location = useLocation();
  const routePath = path ?? location.pathname + (location.search || "");
  const url = `${SITE_URL}${routePath}`;
  const fullTitle = `${title} | ${BRAND}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
    </Helmet>
  );
}
