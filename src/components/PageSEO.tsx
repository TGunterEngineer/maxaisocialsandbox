import { Helmet } from "react-helmet-async";

interface PageSEOProps {
  title: string;
  description?: string;
}

export function PageSEO({ title, description }: PageSEOProps) {
  return (
    <Helmet>
      <title>{`${title} | Maximum Social`}</title>
      {description && <meta name="description" content={description} />}
    </Helmet>
  );
}
