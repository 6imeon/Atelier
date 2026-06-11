/**
 * Industry classification and page-type detection helpers for RALF analytics.
 */

export function classifyIndustry(url: string, brandName: string, pageTitle: string): string {
  const combined = `${url} ${brandName} ${pageTitle}`.toLowerCase();
  if (/bank|financ|invest|insur|capital|fund|fintech|payment/i.test(combined)) return "finance";
  if (/health|medic|pharma|hospital|clinic|wellness|doctor/i.test(combined)) return "healthcare";
  if (/shop|store|ecommerce|product|buy|retail|fashion|cloth/i.test(combined)) return "ecommerce";
  if (/tech|software|saas|app|platform|cloud|data|ai|cyber/i.test(combined)) return "tech";
  if (/design|creative|studio|agency|art|brand|portfolio/i.test(combined)) return "creative";
  if (/news|media|magazine|journal|editorial|publish|blog/i.test(combined)) return "editorial";
  if (/edu|school|university|course|learn|academ|training/i.test(combined)) return "education";
  if (/food|restaurant|cafe|recipe|cook|dining|delivery/i.test(combined)) return "food";
  if (/real.estate|property|home|house|rent|apartment/i.test(combined)) return "realestate";
  if (/travel|hotel|tour|flight|booking|adventure/i.test(combined)) return "travel";
  if (/law|legal|attorney|firm|consult/i.test(combined)) return "professional";
  if (/sport|fitness|gym|athletic|game|entertainment/i.test(combined)) return "entertainment";
  if (/ngo|nonprofit|charity|foundation|volunteer|cause/i.test(combined)) return "nonprofit";
  return "general";
}

export function detectPageType(title: string): string {
  const lower = title.toLowerCase();
  if (/home|landing|main/i.test(lower)) return "homepage";
  if (/about|story|who.we|team/i.test(lower)) return "about";
  if (/service|solution|what.we|offer/i.test(lower)) return "services";
  if (/product|feature|pricing/i.test(lower)) return "product";
  if (/blog|article|insight|news/i.test(lower)) return "blog";
  if (/contact|get.in.touch/i.test(lower)) return "contact";
  if (/case.stud|portfolio|work/i.test(lower)) return "portfolio";
  if (/career|job|hiring/i.test(lower)) return "careers";
  return "landing";
}
