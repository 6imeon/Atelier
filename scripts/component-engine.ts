/**
 * Component Engine CLI
 *
 * Crawls top websites, extracts sections, detects animation patterns,
 * classifies sections, and generates animation briefs.
 *
 * Usage:
 *   npx tsx scripts/component-engine.ts --seed-targets           # Seed crawl target list
 *   npx tsx scripts/component-engine.ts --list-targets            # List all crawl targets
 *   npx tsx scripts/component-engine.ts --crawl <domain>          # Crawl a specific domain
 *   npx tsx scripts/component-engine.ts --crawl-pending           # Crawl all pending targets
 *   npx tsx scripts/component-engine.ts --crawl-pending --count 5 # Crawl N pending targets
 *   npx tsx scripts/component-engine.ts --classify                # LLM-classify low-confidence sections
 *   npx tsx scripts/component-engine.ts --brief                   # Generate animation briefs
 *   npx tsx scripts/component-engine.ts --brief --count 5         # Brief N sections
 *   npx tsx scripts/component-engine.ts --catalogue               # Show animation pattern catalogue
 *   npx tsx scripts/component-engine.ts --stats                   # Show engine stats
 */

import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

// Load .env
const scriptDir = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
const envPath = resolve(scriptDir, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// Default crawl4ai URL for local runs (Docker exposes on port 11235)
if (!process.env.CRAWL4AI_URL) {
  process.env.CRAWL4AI_URL = "http://localhost:11235";
}

// ─── Seed Data ───────────────────────────────────────────────────────────────

interface SeedTarget {
  url: string;
  domain: string;
  industry: string;
  tier: "ftse100" | "sp500" | "awwwards" | "saas" | "custom";
}

const SEED_TARGETS: SeedTarget[] = [
  // ═══════════════════════════════════════════════════════════════════
  // FTSE 100 (100 companies)
  // ═══════════════════════════════════════════════════════════════════

  // Finance / Banking / Insurance
  { url: "https://www.hsbc.com", domain: "hsbc.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.barclays.co.uk", domain: "barclays.co.uk", industry: "finance", tier: "ftse100" },
  { url: "https://www.lloydsbankinggroup.com", domain: "lloydsbankinggroup.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.natwestgroup.com", domain: "natwestgroup.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.standardchartered.com", domain: "standardchartered.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.aviva.com", domain: "aviva.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.prudential.co.uk", domain: "prudential.co.uk", industry: "finance", tier: "ftse100" },
  { url: "https://www.legalandgeneralgroup.com", domain: "legalandgeneralgroup.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.phoenixgroup.com", domain: "phoenixgroup.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.londonstockexchange.com", domain: "londonstockexchange.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.3i.com", domain: "3i.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.schroders.com", domain: "schroders.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.mangroup.com", domain: "mangroup.com", industry: "finance", tier: "ftse100" },
  { url: "https://www.admiral.com", domain: "admiral.com", industry: "finance", tier: "ftse100" },
  // Pharma / Healthcare
  { url: "https://www.astrazeneca.com", domain: "astrazeneca.com", industry: "healthcare", tier: "ftse100" },
  { url: "https://www.gsk.com", domain: "gsk.com", industry: "healthcare", tier: "ftse100" },
  { url: "https://www.haleon.com", domain: "haleon.com", industry: "healthcare", tier: "ftse100" },
  { url: "https://www.smith-nephew.com", domain: "smith-nephew.com", industry: "healthcare", tier: "ftse100" },
  // Consumer / FMCG
  { url: "https://www.unilever.com", domain: "unilever.com", industry: "consumer", tier: "ftse100" },
  { url: "https://www.diageo.com", domain: "diageo.com", industry: "consumer", tier: "ftse100" },
  { url: "https://www.reckitt.com", domain: "reckitt.com", industry: "consumer", tier: "ftse100" },
  { url: "https://www.bat.com", domain: "bat.com", industry: "consumer", tier: "ftse100" },
  { url: "https://www.imb.com", domain: "imb.com", industry: "consumer", tier: "ftse100" },
  // Energy / Oil / Utilities
  { url: "https://www.shell.com", domain: "shell.com", industry: "energy", tier: "ftse100" },
  { url: "https://www.bp.com", domain: "bp.com", industry: "energy", tier: "ftse100" },
  { url: "https://www.nationalgrid.com", domain: "nationalgrid.com", industry: "energy", tier: "ftse100" },
  { url: "https://www.sse.com", domain: "sse.com", industry: "energy", tier: "ftse100" },
  { url: "https://www.centrica.com", domain: "centrica.com", industry: "energy", tier: "ftse100" },
  // Mining / Materials
  { url: "https://www.riotinto.com", domain: "riotinto.com", industry: "mining", tier: "ftse100" },
  { url: "https://www.bhp.com", domain: "bhp.com", industry: "mining", tier: "ftse100" },
  { url: "https://www.glencore.com", domain: "glencore.com", industry: "mining", tier: "ftse100" },
  { url: "https://www.angloamerican.com", domain: "angloamerican.com", industry: "mining", tier: "ftse100" },
  { url: "https://www.antofagasta.co.uk", domain: "antofagasta.co.uk", industry: "mining", tier: "ftse100" },
  { url: "https://www.fresnilloplc.com", domain: "fresnilloplc.com", industry: "mining", tier: "ftse100" },
  { url: "https://www.crh.com", domain: "crh.com", industry: "construction", tier: "ftse100" },
  // Tech / Software
  { url: "https://www.sage.com", domain: "sage.com", industry: "tech", tier: "ftse100" },
  { url: "https://www.darktrace.com", domain: "darktrace.com", industry: "tech", tier: "ftse100" },
  { url: "https://www.aveva.com", domain: "aveva.com", industry: "tech", tier: "ftse100" },
  // Industrial / Engineering / Defence
  { url: "https://www.rolls-royce.com", domain: "rolls-royce.com", industry: "industrial", tier: "ftse100" },
  { url: "https://www.baesystems.com", domain: "baesystems.com", industry: "defence", tier: "ftse100" },
  { url: "https://www.smiths.com", domain: "smiths.com", industry: "industrial", tier: "ftse100" },
  { url: "https://www.spirax-sarco.com", domain: "spirax-sarco.com", industry: "industrial", tier: "ftse100" },
  { url: "https://www.weir.com", domain: "weir.com", industry: "industrial", tier: "ftse100" },
  { url: "https://www.halma.com", domain: "halma.com", industry: "industrial", tier: "ftse100" },
  { url: "https://www.melrose.com", domain: "melrose.com", industry: "industrial", tier: "ftse100" },
  // Retail / Luxury / Consumer
  { url: "https://www.burberry.com", domain: "burberry.com", industry: "fashion", tier: "ftse100" },
  { url: "https://www.jdplc.com", domain: "jdplc.com", industry: "retail", tier: "ftse100" },
  { url: "https://www.tesco.com", domain: "tesco.com", industry: "retail", tier: "ftse100" },
  { url: "https://www.ocadogroup.com", domain: "ocadogroup.com", industry: "retail", tier: "ftse100" },
  { url: "https://www.nextplc.co.uk", domain: "nextplc.co.uk", industry: "retail", tier: "ftse100" },
  { url: "https://www.abf.co.uk", domain: "abf.co.uk", industry: "consumer", tier: "ftse100" },
  { url: "https://corporate.marksandspencer.com", domain: "marksandspencer.com", industry: "retail", tier: "ftse100" },
  // Telecoms / Media
  { url: "https://www.vodafone.com", domain: "vodafone.com", industry: "telecoms", tier: "ftse100" },
  { url: "https://www.bt.com", domain: "bt.com", industry: "telecoms", tier: "ftse100" },
  { url: "https://www.wpp.com", domain: "wpp.com", industry: "media", tier: "ftse100" },
  { url: "https://www.itv.com", domain: "itv.com", industry: "media", tier: "ftse100" },
  { url: "https://www.pearson.com", domain: "pearson.com", industry: "education", tier: "ftse100" },
  { url: "https://www.relx.com", domain: "relx.com", industry: "media", tier: "ftse100" },
  { url: "https://www.rightmove.co.uk", domain: "rightmove.co.uk", industry: "realestate", tier: "ftse100" },
  { url: "https://www.autotrader.co.uk", domain: "autotrader.co.uk", industry: "automotive", tier: "ftse100" },
  // Travel / Hospitality / Leisure
  { url: "https://www.compass-group.com", domain: "compass-group.com", industry: "hospitality", tier: "ftse100" },
  { url: "https://www.ihg.com", domain: "ihg.com", industry: "hospitality", tier: "ftse100" },
  { url: "https://www.whitbread.co.uk", domain: "whitbread.co.uk", industry: "hospitality", tier: "ftse100" },
  { url: "https://www.entaingroup.com", domain: "entaingroup.com", industry: "leisure", tier: "ftse100" },
  { url: "https://www.flutter.com", domain: "flutter.com", industry: "leisure", tier: "ftse100" },
  // Property / REIT
  { url: "https://www.landsec.com", domain: "landsec.com", industry: "realestate", tier: "ftse100" },
  { url: "https://www.segro.com", domain: "segro.com", industry: "realestate", tier: "ftse100" },
  { url: "https://www.britishland.com", domain: "britishland.com", industry: "realestate", tier: "ftse100" },
  // Transport / Logistics
  { url: "https://www.ashtead-group.com", domain: "ashtead-group.com", industry: "industrial", tier: "ftse100" },
  { url: "https://www.iairgroup.com", domain: "iairgroup.com", industry: "travel", tier: "ftse100" },
  { url: "https://www.experian.com", domain: "experian.com", industry: "tech", tier: "ftse100" },
  { url: "https://www.intertek.com", domain: "intertek.com", industry: "industrial", tier: "ftse100" },
  { url: "https://www.informa.com", domain: "informa.com", industry: "media", tier: "ftse100" },

  // ═══════════════════════════════════════════════════════════════════
  // S&P 500 (top ~100 by market cap + design quality)
  // ═══════════════════════════════════════════════════════════════════

  // Tech — Mega cap
  { url: "https://www.apple.com", domain: "apple.com", industry: "tech", tier: "sp500" },
  { url: "https://www.microsoft.com", domain: "microsoft.com", industry: "tech", tier: "sp500" },
  { url: "https://about.google", domain: "about.google", industry: "tech", tier: "sp500" },
  { url: "https://www.amazon.com", domain: "amazon.com", industry: "ecommerce", tier: "sp500" },
  { url: "https://about.meta.com", domain: "meta.com", industry: "tech", tier: "sp500" },
  { url: "https://www.nvidia.com", domain: "nvidia.com", industry: "tech", tier: "sp500" },
  // Tech — Enterprise / SaaS
  { url: "https://www.salesforce.com", domain: "salesforce.com", industry: "tech", tier: "sp500" },
  { url: "https://www.adobe.com", domain: "adobe.com", industry: "tech", tier: "sp500" },
  { url: "https://www.oracle.com", domain: "oracle.com", industry: "tech", tier: "sp500" },
  { url: "https://www.cisco.com", domain: "cisco.com", industry: "tech", tier: "sp500" },
  { url: "https://www.ibm.com", domain: "ibm.com", industry: "tech", tier: "sp500" },
  { url: "https://www.intuit.com", domain: "intuit.com", industry: "tech", tier: "sp500" },
  { url: "https://www.servicenow.com", domain: "servicenow.com", industry: "tech", tier: "sp500" },
  { url: "https://www.snowflake.com", domain: "snowflake.com", industry: "tech", tier: "sp500" },
  { url: "https://www.palantir.com", domain: "palantir.com", industry: "tech", tier: "sp500" },
  { url: "https://www.crowdstrike.com", domain: "crowdstrike.com", industry: "tech", tier: "sp500" },
  // Tech — Hardware / Semiconductors
  { url: "https://www.intel.com", domain: "intel.com", industry: "tech", tier: "sp500" },
  { url: "https://www.amd.com", domain: "amd.com", industry: "tech", tier: "sp500" },
  { url: "https://www.qualcomm.com", domain: "qualcomm.com", industry: "tech", tier: "sp500" },
  { url: "https://www.tesla.com", domain: "tesla.com", industry: "automotive", tier: "sp500" },
  // Finance / Banking
  { url: "https://www.jpmorgan.com", domain: "jpmorgan.com", industry: "finance", tier: "sp500" },
  { url: "https://www.goldmansachs.com", domain: "goldmansachs.com", industry: "finance", tier: "sp500" },
  { url: "https://www.morganstanley.com", domain: "morganstanley.com", industry: "finance", tier: "sp500" },
  { url: "https://www.bankofamerica.com", domain: "bankofamerica.com", industry: "finance", tier: "sp500" },
  { url: "https://www.wellsfargo.com", domain: "wellsfargo.com", industry: "finance", tier: "sp500" },
  { url: "https://www.citigroup.com", domain: "citigroup.com", industry: "finance", tier: "sp500" },
  { url: "https://www.schwab.com", domain: "schwab.com", industry: "finance", tier: "sp500" },
  { url: "https://www.blackrock.com", domain: "blackrock.com", industry: "finance", tier: "sp500" },
  { url: "https://www.visa.com", domain: "visa.com", industry: "finance", tier: "sp500" },
  { url: "https://www.mastercard.com", domain: "mastercard.com", industry: "finance", tier: "sp500" },
  { url: "https://www.paypal.com", domain: "paypal.com", industry: "finance", tier: "sp500" },
  { url: "https://www.americanexpress.com", domain: "americanexpress.com", industry: "finance", tier: "sp500" },
  // Healthcare / Pharma
  { url: "https://www.jnj.com", domain: "jnj.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.pfizer.com", domain: "pfizer.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.abbvie.com", domain: "abbvie.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.merck.com", domain: "merck.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.lilly.com", domain: "lilly.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.unitedhealth.com", domain: "unitedhealth.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.abbott.com", domain: "abbott.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.thermofisher.com", domain: "thermofisher.com", industry: "healthcare", tier: "sp500" },
  // Consumer / Retail
  { url: "https://www.nike.com", domain: "nike.com", industry: "fashion", tier: "sp500" },
  { url: "https://www.coca-colacompany.com", domain: "coca-colacompany.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.pepsico.com", domain: "pepsico.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.pg.com", domain: "pg.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.costco.com", domain: "costco.com", industry: "retail", tier: "sp500" },
  { url: "https://www.homedepot.com", domain: "homedepot.com", industry: "retail", tier: "sp500" },
  { url: "https://www.mcdonalds.com", domain: "mcdonalds.com", industry: "food", tier: "sp500" },
  { url: "https://www.starbucks.com", domain: "starbucks.com", industry: "food", tier: "sp500" },
  // Travel / Hospitality
  { url: "https://www.airbnb.com", domain: "airbnb.com", industry: "travel", tier: "sp500" },
  { url: "https://www.marriott.com", domain: "marriott.com", industry: "hospitality", tier: "sp500" },
  { url: "https://www.hilton.com", domain: "hilton.com", industry: "hospitality", tier: "sp500" },
  { url: "https://www.uber.com", domain: "uber.com", industry: "tech", tier: "sp500" },
  { url: "https://www.booking.com", domain: "booking.com", industry: "travel", tier: "sp500" },
  // Media / Entertainment
  { url: "https://www.thewaltdisneycompany.com", domain: "thewaltdisneycompany.com", industry: "media", tier: "sp500" },
  { url: "https://www.netflix.com", domain: "netflix.com", industry: "media", tier: "sp500" },
  { url: "https://www.spotify.com", domain: "spotify.com", industry: "media", tier: "sp500" },
  { url: "https://www.warnerbros.com", domain: "warnerbros.com", industry: "media", tier: "sp500" },
  // Industrial / Defence / Aerospace
  { url: "https://www.lockheedmartin.com", domain: "lockheedmartin.com", industry: "defence", tier: "sp500" },
  { url: "https://www.boeing.com", domain: "boeing.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.caterpillar.com", domain: "caterpillar.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.3m.com", domain: "3m.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.honeywell.com", domain: "honeywell.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.ge.com", domain: "ge.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.deere.com", domain: "deere.com", industry: "industrial", tier: "sp500" },
  // Energy
  { url: "https://www.exxonmobil.com", domain: "exxonmobil.com", industry: "energy", tier: "sp500" },
  { url: "https://www.chevron.com", domain: "chevron.com", industry: "energy", tier: "sp500" },
  { url: "https://www.conocophillips.com", domain: "conocophillips.com", industry: "energy", tier: "sp500" },
  // Telecoms
  { url: "https://www.t-mobile.com", domain: "t-mobile.com", industry: "telecoms", tier: "sp500" },
  { url: "https://www.verizon.com", domain: "verizon.com", industry: "telecoms", tier: "sp500" },
  { url: "https://www.att.com", domain: "att.com", industry: "telecoms", tier: "sp500" },
  { url: "https://www.comcast.com", domain: "comcast.com", industry: "telecoms", tier: "sp500" },
  { url: "https://www.charter.com", domain: "charter.com", industry: "telecoms", tier: "sp500" },
  // S&P 500 — Additional Tech
  { url: "https://www.broadcom.com", domain: "broadcom.com", industry: "tech", tier: "sp500" },
  { url: "https://www.micron.com", domain: "micron.com", industry: "tech", tier: "sp500" },
  { url: "https://www.ti.com", domain: "ti.com", industry: "tech", tier: "sp500" },
  { url: "https://www.dell.com", domain: "dell.com", industry: "tech", tier: "sp500" },
  { url: "https://www.hpe.com", domain: "hpe.com", industry: "tech", tier: "sp500" },
  { url: "https://www.marvell.com", domain: "marvell.com", industry: "tech", tier: "sp500" },
  { url: "https://www.nxp.com", domain: "nxp.com", industry: "tech", tier: "sp500" },
  { url: "https://www.onsemi.com", domain: "onsemi.com", industry: "tech", tier: "sp500" },
  { url: "https://www.corning.com", domain: "corning.com", industry: "tech", tier: "sp500" },
  { url: "https://www.fortinet.com", domain: "fortinet.com", industry: "tech", tier: "sp500" },
  { url: "https://www.paloaltonetworks.com", domain: "paloaltonetworks.com", industry: "tech", tier: "sp500" },
  { url: "https://www.workday.com", domain: "workday.com", industry: "tech", tier: "sp500" },
  { url: "https://www.datadog.com", domain: "datadog.com", industry: "tech", tier: "sp500" },
  { url: "https://www.synopsys.com", domain: "synopsys.com", industry: "tech", tier: "sp500" },
  { url: "https://www.cadence.com", domain: "cadence.com", industry: "tech", tier: "sp500" },
  { url: "https://www.arista.com", domain: "arista.com", industry: "tech", tier: "sp500" },
  { url: "https://www.akamai.com", domain: "akamai.com", industry: "tech", tier: "sp500" },
  { url: "https://www.motorolasolutions.com", domain: "motorolasolutions.com", industry: "tech", tier: "sp500" },
  { url: "https://www.gartner.com", domain: "gartner.com", industry: "tech", tier: "sp500" },
  { url: "https://www.epam.com", domain: "epam.com", industry: "tech", tier: "sp500" },
  { url: "https://www.ansys.com", domain: "ansys.com", industry: "tech", tier: "sp500" },
  // S&P 500 — Additional Finance / Insurance
  { url: "https://www.usbank.com", domain: "usbank.com", industry: "finance", tier: "sp500" },
  { url: "https://www.pnc.com", domain: "pnc.com", industry: "finance", tier: "sp500" },
  { url: "https://www.truist.com", domain: "truist.com", industry: "finance", tier: "sp500" },
  { url: "https://www.statestreet.com", domain: "statestreet.com", industry: "finance", tier: "sp500" },
  { url: "https://www.spglobal.com", domain: "spglobal.com", industry: "finance", tier: "sp500" },
  { url: "https://www.moodys.com", domain: "moodys.com", industry: "finance", tier: "sp500" },
  { url: "https://www.msci.com", domain: "msci.com", industry: "finance", tier: "sp500" },
  { url: "https://www.cmegroup.com", domain: "cmegroup.com", industry: "finance", tier: "sp500" },
  { url: "https://www.nasdaq.com", domain: "nasdaq.com", industry: "finance", tier: "sp500" },
  { url: "https://www.ice.com", domain: "ice.com", industry: "finance", tier: "sp500" },
  { url: "https://www.aon.com", domain: "aon.com", industry: "finance", tier: "sp500" },
  { url: "https://www.marsh.com", domain: "marsh.com", industry: "finance", tier: "sp500" },
  { url: "https://www.metlife.com", domain: "metlife.com", industry: "finance", tier: "sp500" },
  { url: "https://www.progressive.com", domain: "progressive.com", industry: "finance", tier: "sp500" },
  { url: "https://www.allstate.com", domain: "allstate.com", industry: "finance", tier: "sp500" },
  { url: "https://www.chubb.com", domain: "chubb.com", industry: "finance", tier: "sp500" },
  { url: "https://www.aig.com", domain: "aig.com", industry: "finance", tier: "sp500" },
  { url: "https://www.aflac.com", domain: "aflac.com", industry: "finance", tier: "sp500" },
  { url: "https://www.travelers.com", domain: "travelers.com", industry: "finance", tier: "sp500" },
  { url: "https://www.discover.com", domain: "discover.com", industry: "finance", tier: "sp500" },
  { url: "https://www.fiserv.com", domain: "fiserv.com", industry: "finance", tier: "sp500" },
  { url: "https://www.troweprice.com", domain: "troweprice.com", industry: "finance", tier: "sp500" },
  { url: "https://www.franklintempleton.com", domain: "franklintempleton.com", industry: "finance", tier: "sp500" },
  { url: "https://www.northerntrust.com", domain: "northerntrust.com", industry: "finance", tier: "sp500" },
  { url: "https://www.cboe.com", domain: "cboe.com", industry: "finance", tier: "sp500" },
  { url: "https://www.globalpayments.com", domain: "globalpayments.com", industry: "finance", tier: "sp500" },
  // S&P 500 — Additional Healthcare / MedTech
  { url: "https://www.amgen.com", domain: "amgen.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.gilead.com", domain: "gilead.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.regeneron.com", domain: "regeneron.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.vertex.com", domain: "vertex.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.biogen.com", domain: "biogen.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.bms.com", domain: "bms.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.stryker.com", domain: "stryker.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.medtronic.com", domain: "medtronic.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.bostonscientific.com", domain: "bostonscientific.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.intuitivesurgical.com", domain: "intuitivesurgical.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.edwards.com", domain: "edwards.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.dexcom.com", domain: "dexcom.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.illumina.com", domain: "illumina.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.agilent.com", domain: "agilent.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.bd.com", domain: "bd.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.zoetis.com", domain: "zoetis.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.elevancehealth.com", domain: "elevancehealth.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.cigna.com", domain: "cigna.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.humana.com", domain: "humana.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.hcahealthcare.com", domain: "hcahealthcare.com", industry: "healthcare", tier: "sp500" },
  { url: "https://www.mckesson.com", domain: "mckesson.com", industry: "healthcare", tier: "sp500" },
  // S&P 500 — Additional Consumer / FMCG
  { url: "https://www.colgatepalmolive.com", domain: "colgatepalmolive.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.kimberly-clark.com", domain: "kimberly-clark.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.esteelauder.com", domain: "esteelauder.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.mondelezinternational.com", domain: "mondelezinternational.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.generalmills.com", domain: "generalmills.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.kraftheinzcompany.com", domain: "kraftheinzcompany.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.clorox.com", domain: "clorox.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.sysco.com", domain: "sysco.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.altria.com", domain: "altria.com", industry: "consumer", tier: "sp500" },
  { url: "https://www.molsoncoors.com", domain: "molsoncoors.com", industry: "consumer", tier: "sp500" },
  // S&P 500 — Additional Retail
  { url: "https://www.walmart.com", domain: "walmart.com", industry: "retail", tier: "sp500" },
  { url: "https://www.target.com", domain: "target.com", industry: "retail", tier: "sp500" },
  { url: "https://www.lowes.com", domain: "lowes.com", industry: "retail", tier: "sp500" },
  { url: "https://www.bestbuy.com", domain: "bestbuy.com", industry: "retail", tier: "sp500" },
  { url: "https://www.tjx.com", domain: "tjx.com", industry: "retail", tier: "sp500" },
  { url: "https://www.ulta.com", domain: "ulta.com", industry: "retail", tier: "sp500" },
  { url: "https://www.cvshealth.com", domain: "cvshealth.com", industry: "retail", tier: "sp500" },
  { url: "https://www.kroger.com", domain: "kroger.com", industry: "retail", tier: "sp500" },
  { url: "https://www.autozone.com", domain: "autozone.com", industry: "retail", tier: "sp500" },
  { url: "https://www.dollargeneral.com", domain: "dollargeneral.com", industry: "retail", tier: "sp500" },
  { url: "https://www.tractorsupply.com", domain: "tractorsupply.com", industry: "retail", tier: "sp500" },
  // S&P 500 — Additional Food / Restaurants
  { url: "https://www.chipotle.com", domain: "chipotle.com", industry: "food", tier: "sp500" },
  { url: "https://www.yum.com", domain: "yum.com", industry: "food", tier: "sp500" },
  { url: "https://www.dominos.com", domain: "dominos.com", industry: "food", tier: "sp500" },
  { url: "https://www.darden.com", domain: "darden.com", industry: "food", tier: "sp500" },
  // S&P 500 — Additional Travel / Hospitality
  { url: "https://www.expedia.com", domain: "expedia.com", industry: "travel", tier: "sp500" },
  { url: "https://www.delta.com", domain: "delta.com", industry: "travel", tier: "sp500" },
  { url: "https://www.united.com", domain: "united.com", industry: "travel", tier: "sp500" },
  { url: "https://www.southwest.com", domain: "southwest.com", industry: "travel", tier: "sp500" },
  { url: "https://www.royalcaribbean.com", domain: "royalcaribbean.com", industry: "travel", tier: "sp500" },
  // S&P 500 — Additional Media / Entertainment
  { url: "https://www.paramount.com", domain: "paramount.com", industry: "media", tier: "sp500" },
  { url: "https://www.ea.com", domain: "ea.com", industry: "media", tier: "sp500" },
  { url: "https://www.take2games.com", domain: "take2games.com", industry: "media", tier: "sp500" },
  { url: "https://www.omnicomgroup.com", domain: "omnicomgroup.com", industry: "media", tier: "sp500" },
  { url: "https://www.nytco.com", domain: "nytco.com", industry: "media", tier: "sp500" },
  // S&P 500 — Additional Industrial / Defence
  { url: "https://www.rtx.com", domain: "rtx.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.northropgrumman.com", domain: "northropgrumman.com", industry: "defence", tier: "sp500" },
  { url: "https://www.gd.com", domain: "gd.com", industry: "defence", tier: "sp500" },
  { url: "https://www.l3harris.com", domain: "l3harris.com", industry: "defence", tier: "sp500" },
  { url: "https://www.emerson.com", domain: "emerson.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.danaher.com", domain: "danaher.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.eaton.com", domain: "eaton.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.parker.com", domain: "parker.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.itw.com", domain: "itw.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.cummins.com", domain: "cummins.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.paccar.com", domain: "paccar.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.otis.com", domain: "otis.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.carrier.com", domain: "carrier.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.johnsoncontrols.com", domain: "johnsoncontrols.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.wm.com", domain: "wm.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.republicservices.com", domain: "republicservices.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.cintas.com", domain: "cintas.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.grainger.com", domain: "grainger.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.rockwellautomation.com", domain: "rockwellautomation.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.xylem.com", domain: "xylem.com", industry: "industrial", tier: "sp500" },
  { url: "https://www.fortive.com", domain: "fortive.com", industry: "industrial", tier: "sp500" },
  // S&P 500 — Additional Energy / Utilities
  { url: "https://www.slb.com", domain: "slb.com", industry: "energy", tier: "sp500" },
  { url: "https://www.halliburton.com", domain: "halliburton.com", industry: "energy", tier: "sp500" },
  { url: "https://www.bakerhughes.com", domain: "bakerhughes.com", industry: "energy", tier: "sp500" },
  { url: "https://www.marathonpetroleum.com", domain: "marathonpetroleum.com", industry: "energy", tier: "sp500" },
  { url: "https://www.valero.com", domain: "valero.com", industry: "energy", tier: "sp500" },
  { url: "https://www.phillips66.com", domain: "phillips66.com", industry: "energy", tier: "sp500" },
  { url: "https://www.hess.com", domain: "hess.com", industry: "energy", tier: "sp500" },
  { url: "https://www.nexteraenergy.com", domain: "nexteraenergy.com", industry: "energy", tier: "sp500" },
  { url: "https://www.duke-energy.com", domain: "duke-energy.com", industry: "energy", tier: "sp500" },
  { url: "https://www.southerncompany.com", domain: "southerncompany.com", industry: "energy", tier: "sp500" },
  { url: "https://www.dominionenergy.com", domain: "dominionenergy.com", industry: "energy", tier: "sp500" },
  { url: "https://www.sempra.com", domain: "sempra.com", industry: "energy", tier: "sp500" },
  { url: "https://www.constellationenergy.com", domain: "constellationenergy.com", industry: "energy", tier: "sp500" },
  { url: "https://www.kindermorgan.com", domain: "kindermorgan.com", industry: "energy", tier: "sp500" },
  // S&P 500 — Automotive
  { url: "https://www.gm.com", domain: "gm.com", industry: "automotive", tier: "sp500" },
  { url: "https://www.ford.com", domain: "ford.com", industry: "automotive", tier: "sp500" },
  { url: "https://www.carvana.com", domain: "carvana.com", industry: "automotive", tier: "sp500" },
  // S&P 500 — Fashion / Apparel
  { url: "https://www.ralphlauren.com", domain: "ralphlauren.com", industry: "fashion", tier: "sp500" },
  { url: "https://www.tapestry.com", domain: "tapestry.com", industry: "fashion", tier: "sp500" },
  { url: "https://www.pvh.com", domain: "pvh.com", industry: "fashion", tier: "sp500" },
  // S&P 500 — Materials / Chemicals
  { url: "https://www.linde.com", domain: "linde.com", industry: "mining", tier: "sp500" },
  { url: "https://www.airproducts.com", domain: "airproducts.com", industry: "mining", tier: "sp500" },
  { url: "https://www.sherwin-williams.com", domain: "sherwin-williams.com", industry: "mining", tier: "sp500" },
  { url: "https://www.ecolab.com", domain: "ecolab.com", industry: "mining", tier: "sp500" },
  { url: "https://www.dupont.com", domain: "dupont.com", industry: "mining", tier: "sp500" },
  { url: "https://www.dow.com", domain: "dow.com", industry: "mining", tier: "sp500" },
  { url: "https://www.ppg.com", domain: "ppg.com", industry: "mining", tier: "sp500" },
  { url: "https://www.newmont.com", domain: "newmont.com", industry: "mining", tier: "sp500" },
  { url: "https://www.nucor.com", domain: "nucor.com", industry: "mining", tier: "sp500" },
  { url: "https://www.vulcanmat.com", domain: "vulcanmat.com", industry: "mining", tier: "sp500" },
  // S&P 500 — Real Estate / REITs
  { url: "https://www.prologis.com", domain: "prologis.com", industry: "realestate", tier: "sp500" },
  { url: "https://www.americantower.com", domain: "americantower.com", industry: "realestate", tier: "sp500" },
  { url: "https://www.equinix.com", domain: "equinix.com", industry: "realestate", tier: "sp500" },
  { url: "https://www.crowncastle.com", domain: "crowncastle.com", industry: "realestate", tier: "sp500" },
  { url: "https://www.digitalrealty.com", domain: "digitalrealty.com", industry: "realestate", tier: "sp500" },
  { url: "https://www.realtyincome.com", domain: "realtyincome.com", industry: "realestate", tier: "sp500" },
  { url: "https://www.simon.com", domain: "simon.com", industry: "realestate", tier: "sp500" },
  { url: "https://www.cbre.com", domain: "cbre.com", industry: "realestate", tier: "sp500" },
  { url: "https://www.ironmountain.com", domain: "ironmountain.com", industry: "realestate", tier: "sp500" },
  // S&P 500 — Ecommerce
  { url: "https://www.ebay.com", domain: "ebay.com", industry: "ecommerce", tier: "sp500" },
  { url: "https://www.etsy.com", domain: "etsy.com", industry: "ecommerce", tier: "sp500" },
  // S&P 500 — Construction / Homebuilders
  { url: "https://www.lennar.com", domain: "lennar.com", industry: "construction", tier: "sp500" },
  { url: "https://www.drhorton.com", domain: "drhorton.com", industry: "construction", tier: "sp500" },
  // S&P 500 — Leisure / Gaming
  { url: "https://www.mgmresorts.com", domain: "mgmresorts.com", industry: "leisure", tier: "sp500" },
  { url: "https://www.caesars.com", domain: "caesars.com", industry: "leisure", tier: "sp500" },

  // ═══════════════════════════════════════════════════════════════════
  // SaaS / Premium Design (known for excellent web design)
  // ═══════════════════════════════════════════════════════════════════
  { url: "https://stripe.com", domain: "stripe.com", industry: "tech", tier: "saas" },
  { url: "https://linear.app", domain: "linear.app", industry: "tech", tier: "saas" },
  { url: "https://vercel.com", domain: "vercel.com", industry: "tech", tier: "saas" },
  { url: "https://www.notion.so", domain: "notion.so", industry: "tech", tier: "saas" },
  { url: "https://www.figma.com", domain: "figma.com", industry: "tech", tier: "saas" },
  { url: "https://www.framer.com", domain: "framer.com", industry: "tech", tier: "saas" },
  { url: "https://supabase.com", domain: "supabase.com", industry: "tech", tier: "saas" },
  { url: "https://www.loom.com", domain: "loom.com", industry: "tech", tier: "saas" },
  { url: "https://www.pitch.com", domain: "pitch.com", industry: "tech", tier: "saas" },
  { url: "https://railway.app", domain: "railway.app", industry: "tech", tier: "saas" },
  { url: "https://planetscale.com", domain: "planetscale.com", industry: "tech", tier: "saas" },
  { url: "https://www.retool.com", domain: "retool.com", industry: "tech", tier: "saas" },
  { url: "https://resend.com", domain: "resend.com", industry: "tech", tier: "saas" },
  { url: "https://cal.com", domain: "cal.com", industry: "tech", tier: "saas" },
  { url: "https://dub.co", domain: "dub.co", industry: "tech", tier: "saas" },

  // ═══════════════════════════════════════════════════════════════════
  // Awwwards / Editorial / Design Excellence
  // ═══════════════════════════════════════════════════════════════════
  { url: "https://report.adidas-group.com", domain: "report.adidas-group.com", industry: "fashion", tier: "awwwards" },
  { url: "https://www.apple.com/apple-vision-pro", domain: "apple.com/apple-vision-pro", industry: "tech", tier: "awwwards" },
  { url: "https://www.porsche.com", domain: "porsche.com", industry: "automotive", tier: "awwwards" },
  { url: "https://www.ferrari.com", domain: "ferrari.com", industry: "automotive", tier: "awwwards" },
  { url: "https://www.rolex.com", domain: "rolex.com", industry: "fashion", tier: "awwwards" },
  { url: "https://www.gucci.com", domain: "gucci.com", industry: "fashion", tier: "awwwards" },
  { url: "https://www.louisvuitton.com", domain: "louisvuitton.com", industry: "fashion", tier: "awwwards" },
  { url: "https://www.cartier.com", domain: "cartier.com", industry: "fashion", tier: "awwwards" },
  { url: "https://www.dior.com", domain: "dior.com", industry: "fashion", tier: "awwwards" },
  { url: "https://www.chanel.com", domain: "chanel.com", industry: "fashion", tier: "awwwards" },
];

// ─── MongoDB Helpers (direct MongoClient — no deep SDK imports) ──────────────

import { MongoClient, type Db } from "mongodb";

let _client: MongoClient;
let _db: Db;

async function getDb(): Promise<Db> {
  if (_db) return _db;
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("MONGO_URI not set in .env"); process.exit(1); }
  _client = new MongoClient(uri);
  await _client.connect();
  _db = _client.db("atelier");
  return _db;
}

async function closeDb() { if (_client) await _client.close(); }

// ─── Args ────────────────────────────────────────────────────────────────────

function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function seedTargets() {
  const db = await getDb();
  const targets = db.collection("crawl_targets");

  // Ensure indexes
  await targets.createIndex({ domain: 1 }, { unique: true });
  await targets.createIndex({ status: 1, tier: 1 });

  console.log(`Seeding ${SEED_TARGETS.length} crawl targets...`);
  let created = 0;
  for (const t of SEED_TARGETS) {
    const existing = await targets.findOne({ domain: t.domain });
    if (existing) {
      console.log(`  skip: ${t.domain} (already exists, status: ${existing.status})`);
      continue;
    }
    await targets.insertOne({
      ...t,
      crawlCount: 0,
      pagesCrawled: [],
      sectionsExtracted: 0,
      status: "pending",
      createdAt: new Date(),
    });
    console.log(`  add:  ${t.domain} (${t.tier}, ${t.industry})`);
    created++;
  }
  console.log(`\nDone. ${created} new targets added, ${SEED_TARGETS.length - created} already existed.`);
}

async function listTargets() {
  const db = await getDb();
  const docs = await db.collection("crawl_targets").find().sort({ status: 1, domain: 1 }).toArray();

  if (docs.length === 0) {
    console.log("No crawl targets. Run --seed-targets first.");
    return;
  }
  console.log(`\n${"Domain".padEnd(35)} ${"Tier".padEnd(10)} ${"Industry".padEnd(12)} ${"Status".padEnd(10)} ${"Sections".padEnd(8)} Last Crawled`);
  console.log("─".repeat(100));
  for (const t of docs) {
    console.log(
      `${(t.domain || "").padEnd(35)} ${(t.tier || "").padEnd(10)} ${(t.industry || "").padEnd(12)} ${(t.status || "").padEnd(10)} ${String(t.sectionsExtracted || 0).padEnd(8)} ${t.lastCrawled || "never"}`,
    );
  }
  console.log(`\nTotal: ${docs.length} targets`);
}

// ─── Engine-specific page fetcher ────────────────────────────────────────────
// Separate from redesign.ts fetchPage — optimized for bulk crawling with
// better timeout handling, retry logic, and detailed error logging.

interface EngineFetchResult {
  html: string;
  markdown: string;
  fromCrawl4ai: boolean;
}

async function _crawl4aiRequest(
  crawl4aiUrl: string,
  url: string,
  config: Record<string, unknown>,
  timeoutMs: number,
  label: string,
  log: { info: (m: string) => void; warn: (m: string) => void; debug: (m: string) => void },
): Promise<EngineFetchResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    log.info(`crawl4ai (${label}): ${url}`);
    const res = await fetch(`${crawl4aiUrl}/crawl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        urls: [url],
        word_count_threshold: 10,
        crawler_config: config,
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.warn(`crawl4ai HTTP ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ""}`);
      return null;
    }

    const data = await res.json();
    const result = data.results?.[0] ?? data;

    if (result.success === false || result.status_code >= 400) {
      log.warn(`crawl4ai upstream error: status=${result.status_code ?? "?"}, error=${result.error_message ?? result.error ?? "unknown"}`);
      return null;
    }

    const rawMd = result.markdown ?? result.extracted_content ?? "";
    const md = typeof rawMd === "string" ? rawMd : (rawMd?.raw_markdown ?? rawMd?.fit_markdown ?? JSON.stringify(rawMd) ?? "");
    const rawHtml = result.html ?? result.raw_html ?? "";
    const html = typeof rawHtml === "string" ? rawHtml : "";

    if (md || html) {
      log.info(`Success: ${md.length} chars markdown, ${html.length} chars html`);
      return { html, markdown: md, fromCrawl4ai: true };
    }

    log.warn(`crawl4ai returned empty content, keys: ${Object.keys(result).join(",")}`);
    return null;
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
    if (isTimeout) {
      log.warn(`crawl4ai timeout after ${timeoutMs / 1000}s (${label})`);
    } else {
      log.warn(`crawl4ai error (${label}): ${err instanceof Error ? `${err.name}: ${err.message}` : err}`);
    }
    return null;
  }
}

async function fetchPageForEngine(
  url: string,
  log: { info: (m: string) => void; warn: (m: string) => void; debug: (m: string) => void },
): Promise<EngineFetchResult> {
  const crawl4aiUrl = process.env.CRAWL4AI_URL;

  if (crawl4aiUrl) {
    // Attempt 1: domcontentloaded + 5s render delay (handles most sites)
    const r1 = await _crawl4aiRequest(crawl4aiUrl, url, {
      wait_until: "domcontentloaded",
      delay_before_return_html: 5,
      page_timeout: 30000,
    }, 45_000, "attempt 1", log);
    if (r1) return r1;

    // Attempt 2: minimal config, shorter timeout — catches simpler sites that choked on attempt 1
    const r2 = await _crawl4aiRequest(crawl4aiUrl, url, {
      wait_until: "domcontentloaded",
      delay_before_return_html: 2,
      page_timeout: 15000,
    }, 25_000, "attempt 2 minimal", log);
    if (r2) return r2;
  }

  // Fallback: direct HTTP fetch (no JS rendering)
  try {
    log.info(`Direct fetch: ${url}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
    });
    clearTimeout(timer);
    const html = await res.text();
    log.info(`Direct fetch: ${html.length} chars`);
    return { html, markdown: "", fromCrawl4ai: false };
  } catch (err) {
    log.warn(`Direct fetch failed: ${err instanceof Error ? err.message : err}`);
    return { html: "", markdown: "", fromCrawl4ai: false };
  }
}

async function crawlDomain(domain: string) {
  const db = await getDb();
  const targets = db.collection("crawl_targets");
  const rawSections = db.collection("raw_sections");
  const animPatterns = db.collection("animation_patterns");

  // Ensure indexes on first use
  await rawSections.createIndex({ sourceDomain: 1, "classification.category": 1 });
  await rawSections.createIndex({ "classification.tier": 1, status: 1 });
  await rawSections.createIndex({ structuralHash: 1 });
  await animPatterns.createIndex({ domain: 1, "pattern.type": 1, "pattern.trigger": 1 });

  const target = await targets.findOne({ domain });
  if (!target) {
    console.error(`No crawl target for "${domain}". Run --seed-targets or add it.`);
    process.exit(1);
  }

  console.log(`\n── CRAWL: ${target.domain} (${target.tier}, ${target.industry}) ──\n`);

  // 1. Fetch the page
  const { createPipelineRun } = await import("../packages/sdk/src/utils/logger.js");
  const log = createPipelineRun();
  log.phase("FETCH");

  const fetched = await fetchPageForEngine(target.url, log);
  if (!fetched.html || fetched.html.length < 500) {
    console.error(`Failed to fetch ${target.url} — got ${fetched.html?.length || 0} chars`);
    await targets.updateOne({ domain }, { $set: { status: "failed" } });
    return;
  }
  console.log(`  Fetched: ${fetched.html.length} chars (crawl4ai: ${fetched.fromCrawl4ai})`);

  // 2. Extract sections
  log.phase("EXTRACT");
  const { extractSections, summarizeExtraction } = await import("../packages/sdk/src/utils/section-extractor.js");
  const sections = extractSections(fetched.html, {
    sourceUrl: target.url,
    minTextLength: 30,
    minHtmlLength: 80,
  });
  console.log(`  ${summarizeExtraction(sections)}`);

  if (sections.length === 0) {
    console.log("  No sections extracted.");
    await targets.updateOne({ domain }, { $set: { status: "crawled", lastCrawled: new Date().toISOString() } });
    return;
  }

  // 3. Save sections + animation patterns to MongoDB
  log.phase("SAVE");
  let savedCount = 0;
  const now = new Date().toISOString();

  for (const section of sections) {
    // Check for structural duplicates already in DB
    const dup = await rawSections.findOne({ structuralHash: section.structuralHash, sourceDomain: section.sourceDomain });
    if (dup) {
      console.log(`  skip: duplicate hash ${section.structuralHash.slice(0, 8)} (${section.classification.category})`);
      continue;
    }

    const result = await rawSections.insertOne({
      sourceUrl: section.sourceUrl,
      sourceDomain: section.sourceDomain,
      industry: target.industry,
      html: section.html.slice(0, 50_000),
      htmlLength: section.htmlLength,
      textContent: section.textContent.slice(0, 5000),
      classification: {
        category: section.classification.category,
        confidence: section.classification.confidence,
        subType: section.classification.subType,
        method: section.classification.method,
        tier: section.tier,
        features: section.classification.features,
      },
      animations: section.animations.map(a => ({
        type: a.type, trigger: a.trigger,
        properties: a.properties, description: a.description,
      })),
      structuralHash: section.structuralHash,
      status: section.classification.confidence >= 0.5 ? "classified" : "raw",
      extractedAt: now,
      createdAt: new Date(),
    });

    const sectionId = result.insertedId.toString();
    savedCount++;

    // Upsert animation patterns
    for (const anim of section.animations) {
      await animPatterns.updateOne(
        { domain: section.sourceDomain, "pattern.type": anim.type, "pattern.trigger": anim.trigger },
        {
          $set: { url: section.sourceUrl, industry: target.industry, pattern: { type: anim.type, trigger: anim.trigger, properties: anim.properties, description: anim.description }, lastSeen: now },
          $inc: { frequency: 1 },
          $setOnInsert: { firstSeen: now, createdAt: new Date() },
          $addToSet: { exampleSectionIds: sectionId },
        },
        { upsert: true },
      );
    }
  }

  // 4. Update crawl target
  await targets.updateOne({ domain }, {
    $set: { status: "crawled", lastCrawled: now },
    $inc: { crawlCount: 1, sectionsExtracted: savedCount },
    $addToSet: { pagesCrawled: target.url },
  });

  const animatedCount = sections.filter(s => s.animations.length > 0).length;
  console.log(`  Saved ${savedCount} sections (${animatedCount} with animations)`);
  log.done();
}

async function crawlPending(count: number) {
  const db = await getDb();
  const docs = await db.collection("crawl_targets").find({ status: "pending" }).sort({ domain: 1 }).toArray();

  if (docs.length === 0) {
    console.log("No pending crawl targets.");
    return;
  }
  const batch = docs.slice(0, count);
  console.log(`Crawling ${batch.length} of ${docs.length} pending targets...\n`);

  for (const target of batch) {
    try {
      await crawlDomain(target.domain);
    } catch (err) {
      console.error(`  Error crawling ${target.domain}: ${err instanceof Error ? err.message : err}`);
      await db.collection("crawl_targets").updateOne({ domain: target.domain }, { $set: { status: "failed" } });
    }
    console.log();
  }
}

async function classifyLowConfidence() {
  const db = await getDb();
  const docs = await db.collection("raw_sections").find({ status: "raw" }).limit(100).toArray();

  if (docs.length === 0) {
    console.log("No unclassified sections (status: raw).");
    return;
  }

  console.log(`LLM-classifying ${docs.length} low-confidence sections...\n`);

  const { getRouter } = await import("../packages/sdk/src/utils/router.js");
  const { classifySectionLLM } = await import("../packages/sdk/src/utils/section-classifier.js");
  const { extractSections } = await import("../packages/sdk/src/utils/section-extractor.js");
  const router = getRouter();

  let classified = 0;
  for (const doc of docs) {
    // Build a minimal ExtractedSection for the classifier
    const extracted = extractSections(doc.html, { sourceUrl: doc.sourceUrl });
    if (extracted.length === 0) {
      await db.collection("raw_sections").updateOne({ _id: doc._id }, { $set: { status: "classified" } });
      continue;
    }

    try {
      const result = await classifySectionLLM(router, extracted[0]);
      console.log(`  [${doc.sourceDomain}] ${doc.classification.category} (${doc.classification.confidence.toFixed(2)}) → ${result.category} (${result.confidence.toFixed(2)}) [${result.tier}]`);

      await db.collection("raw_sections").updateOne({ _id: doc._id }, {
        $set: {
          "classification.category": result.category,
          "classification.confidence": result.confidence,
          "classification.subType": result.subType,
          "classification.method": "llm",
          "classification.tier": result.tier,
          status: "classified",
          updatedAt: new Date(),
        },
      });
      classified++;
    } catch (err) {
      console.warn(`  Failed for ${doc.sourceDomain}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nClassified ${classified} sections.`);
}

async function generateBriefs(count: number) {
  const db = await getDb();
  // Get animated/cinematic sections without briefs
  const docs = await db.collection("raw_sections").find({
    status: "classified",
    "classification.tier": { $in: ["animated", "cinematic"] },
    animationBrief: { $exists: false },
  }).limit(count).toArray();

  if (docs.length === 0) {
    console.log("No animated sections awaiting briefs.");
    return;
  }

  console.log(`Generating animation briefs for ${docs.length} sections...\n`);

  // Check if playwright is available — reuse a single browser instance for the whole batch
  let screenshotService: any = null;
  try {
    const { ScreenshotService } = await import("../packages/sdk/src/screenshot/service.js");
    screenshotService = new ScreenshotService();
    console.log("  (Playwright available — using screenshot-enhanced briefs)\n");
  } catch {
    console.log("  (Playwright not installed — using pattern-only briefs)\n");
  }

  const { getRouter } = await import("../packages/sdk/src/utils/router.js");
  const { generateAnimationBrief } = await import("../packages/sdk/src/utils/section-classifier.js");
  const router = getRouter();

  let briefed = 0;
  for (const doc of docs) {
    const animPatterns = (doc.animations || []).map((a: any) => ({
      type: a.type, trigger: a.trigger, properties: a.properties || [],
      description: a.description || "",
    }));

    let brief: any;

    if (screenshotService) {
      try {
        const seq = await screenshotService.captureScrollSequence(doc.html, { scale: 1 });
        brief = await generateAnimationBrief(router, seq.buffers, seq.labels, doc.classification.category, animPatterns);
      } catch (err) {
        console.warn(`  Screenshot failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (!brief) {
      // Fallback: pattern-only brief (no screenshots)
      brief = {
        sectionType: doc.classification.category,
        animationStyle: "detected-patterns",
        effects: animPatterns.map((p: any) => ({
          element: "unknown", animation: p.type, trigger: `on-${p.trigger}`,
          timing: "unknown", detail: p.description,
        })),
        libraries: [...new Set(animPatterns.map((p: any) => p.type).filter((t: string) =>
          ["gsap", "scrolltrigger", "swiper", "lottie"].includes(t),
        ))],
        complexity: animPatterns.some((p: any) => p.properties?.includes("pin")) ? "cinematic" : "intermediate",
      };
    }

    await db.collection("raw_sections").updateOne({ _id: doc._id }, {
      $set: { animationBrief: brief, status: "briefed", updatedAt: new Date() },
    });
    console.log(`  [${doc.sourceDomain}] ${doc.classification.category} → ${brief.animationStyle} (${brief.complexity}, ${brief.effects.length} effects)`);
    briefed++;
  }

  // Clean up shared browser instance
  if (screenshotService) {
    try { await screenshotService.close(); } catch {}
  }

  console.log(`\nGenerated ${briefed} animation briefs.`);
}

async function showCatalogue() {
  const db = await getDb();
  const result = await db.collection("animation_patterns").aggregate([
    { $group: {
      _id: { type: "$pattern.type", trigger: "$pattern.trigger" },
      frequency: { $sum: "$frequency" },
      domains: { $addToSet: "$domain" },
    }},
    { $project: {
      type: "$_id.type", trigger: "$_id.trigger",
      frequency: 1, domains: { $size: "$domains" },
    }},
    { $sort: { frequency: -1 } },
  ]).toArray();

  if (result.length === 0) {
    console.log("No animation patterns catalogued yet. Run --crawl first.");
    return;
  }

  console.log(`\n${"Pattern Type".padEnd(25)} ${"Trigger".padEnd(18)} ${"Frequency".padEnd(12)} Domains`);
  console.log("─".repeat(70));
  for (const p of result) {
    console.log(`${(p.type || "").padEnd(25)} ${(p.trigger || "").padEnd(18)} ${String(p.frequency || 0).padEnd(12)} ${p.domains}`);
  }
  console.log(`\nTotal: ${result.length} unique patterns`);
}

async function showStats() {
  const db = await getDb();

  const crawlTargets = await db.collection("crawl_targets").countDocuments();
  const rawSections = await db.collection("raw_sections").countDocuments();
  const animationPatternsCount = await db.collection("animation_patterns").countDocuments();

  console.log(`\n── Component Engine Stats ──\n`);
  console.log(`Crawl targets:      ${crawlTargets}`);
  console.log(`Raw sections:       ${rawSections}`);
  console.log(`Animation patterns: ${animationPatternsCount}`);

  if (rawSections > 0) {
    const tierAgg = await db.collection("raw_sections").aggregate([
      { $group: { _id: "$classification.tier", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();
    console.log(`\nBy tier:`);
    for (const r of tierAgg) console.log(`  ${String(r._id).padEnd(15)} ${r.count}`);

    const catAgg = await db.collection("raw_sections").aggregate([
      { $group: { _id: "$classification.category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();
    console.log(`\nBy category:`);
    for (const r of catAgg) console.log(`  ${String(r._id).padEnd(15)} ${r.count}`);

    // Status breakdown
    const statusAgg = await db.collection("raw_sections").aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();
    console.log(`\nBy status:`);
    for (const r of statusAgg) console.log(`  ${String(r._id).padEnd(15)} ${r.count}`);
  }
}

// ─── Phase 2.5: Enhance Skeleton Components ──────────────────────────────────

async function enhanceSkeletonFile(filePath: string, domain: string, description?: string, colors?: string, images?: string, cssOnly = true) {
  if (!filePath) {
    console.error("Usage: --enhance <path-to-skeleton.html> [--domain name] [--colors palette] [--images style] [--description text] [--full-html]");
    process.exit(1);
  }

  const { readFileSync } = await import("fs");
  const { resolve } = await import("path");
  const { getRouter } = await import("../packages/sdk/src/utils/router.js");
  const { enhanceFromSkeleton, scoreQualityStatic, qualityGate, normalizeHtml } = await import("../packages/sdk/src/utils/component-generator.js");

  const skeletonPath = resolve(filePath);
  let skeletonHtml: string;
  try {
    skeletonHtml = readFileSync(skeletonPath, "utf-8");
  } catch {
    console.error(`File not found: ${skeletonPath}`);
    process.exit(1);
  }

  // Strip DOCTYPE/html/head/body wrapper if present — extract just the section content
  const bodyMatch = skeletonHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) skeletonHtml = bodyMatch[1].trim();
  // Remove spacer divs if present
  skeletonHtml = skeletonHtml.replace(/<div[^>]*>.*?Scroll down.*?<\/div>/gi, "").replace(/<div[^>]*>.*?End.*?<\/div>/gi, "").trim();

  console.log(`\n── ENHANCE SKELETON ──\n`);
  console.log(`  Mode: ${cssOnly ? "CSS-only (safe)" : "Full HTML (legacy)"}`);
  console.log(`  File: ${skeletonPath}`);
  console.log(`  Skeleton size: ${skeletonHtml.length} chars`);
  console.log(`  Domain: ${domain}`);
  if (description) console.log(`  Description: ${description}`);
  if (colors) console.log(`  Colors: ${colors}`);
  if (images) console.log(`  Images: ${images}`);

  const router = getRouter();

  console.log(`\n  Sending to Kimi K2.5 for ${cssOnly ? "CSS-only" : "full"} enhancement...\n`);

  try {
    const { html, tokensUsed } = await enhanceFromSkeleton(router, skeletonHtml, {
      description,
      colorPalette: colors,
      imageStyle: images,
      cssOnly,
    });

    if (!html || html.length < 100) {
      console.error("  ERROR: Empty response from Kimi");
      return;
    }

    // Score quality
    const report = scoreQualityStatic(html);
    const decision = qualityGate({ ...report, jsErrors: [] });

    let finalHtml = html;
    if (decision === "normalize") {
      finalHtml = normalizeHtml(html);
      const newReport = scoreQualityStatic(finalHtml);
      console.log(`  NORMALIZE: ${report.overall}/10 → ${newReport.overall}/10 [${newReport.tier}]`);
    } else if (decision === "reject") {
      console.log(`  REJECT: ${report.overall}/10 — ${report.issues.slice(0, 3).join(", ")}`);
      console.log("  Saving anyway (skeleton-enhanced components may score lower on static checks)");
    } else {
      console.log(`  ACCEPT: ${report.overall}/10 [${report.tier}] (${tokensUsed || "?"} tokens)`);
    }

    // Save to generated_components
    const db = await getDb();
    const id = `enhanced-${domain}-${Date.now().toString(36)}`;
    await db.collection("generated_components").updateOne(
      { id },
      { $set: {
        id,
        name: `Enhanced: ${description || filePath.split("/").pop()?.replace(".html", "") || "skeleton"}`,
        category: "hero",
        html: finalHtml,
        tokens: tokensUsed || 0,
        source: { domain, persona: "none", method: cssOnly ? "css-only-enhance" : "enhance-from-skeleton", skeletonFile: filePath },
        qualityReport: scoreQualityStatic(finalHtml),
        generatedAt: new Date(),
      }},
      { upsert: true },
    );

    console.log(`\n  Saved: ${id} (${finalHtml.length} chars)`);
    console.log("  Check #/review to preview.");
  } catch (err) {
    console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
  }
}

// ─── Screenshot Cleanup ─────────────────────────────────────────────────────

async function cleanupScreenshots(dir?: string) {
  const { readdirSync, unlinkSync, existsSync, statSync, rmdirSync } = await import("fs");
  const { resolve, join } = await import("path");

  const screenshotDir = dir || resolve(__dirname, "adidas-screenshots");
  if (!existsSync(screenshotDir)) {
    console.log("No screenshot directory found.");
    return;
  }

  let totalRemoved = 0;
  const removeDir = (dirPath: string) => {
    const entries = readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        removeDir(fullPath);
      } else if (/\.(png|jpg|jpeg|webp|svg)$/i.test(entry)) {
        unlinkSync(fullPath);
        totalRemoved++;
      }
    }
    // Remove empty subdirectories
    const remaining = readdirSync(dirPath);
    if (remaining.length === 0 && dirPath !== screenshotDir) {
      rmdirSync(dirPath);
    }
  };

  removeDir(screenshotDir);
  console.log(`Cleaned up ${totalRemoved} screenshot files from ${screenshotDir}`);

  // Report disk space saved
  if (totalRemoved > 0) {
    console.log("Screenshots are only needed during generation and can be re-captured with --capture.");
  }
}

// ─── Skeleton Library ───────────────────────────────────────────────────────

function listSkeletons(): string[] {
  const { readdirSync, existsSync } = require("fs");
  const { resolve } = require("path");
  const dir = resolve(__dirname, "skeletons");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f: string) => f.endsWith(".html")).sort();
}

async function showSkeletons() {
  const skeletons = listSkeletons();
  if (skeletons.length === 0) {
    console.log("\nNo skeletons found in scripts/skeletons/");
    console.log("Add .html files with working animation patterns to use with --enhance-skeleton\n");
    return;
  }
  const { readFileSync } = await import("fs");
  const { resolve } = await import("path");
  console.log(`\n── SKELETON LIBRARY (${skeletons.length} patterns) ──\n`);
  for (const file of skeletons) {
    const html = readFileSync(resolve(__dirname, "skeletons", file), "utf-8");
    // Extract description from first HTML comment
    const descMatch = html.match(/<!--\s*(.*?)\s*-->/);
    const desc = descMatch ? descMatch[1].slice(0, 80) : "(no description)";
    const sizeKb = (html.length / 1024).toFixed(1);
    const hasGsap = /gsap|ScrollTrigger/i.test(html);
    const hasSwiper = /swiper/i.test(html);
    const libs = [hasGsap && "GSAP", hasSwiper && "Swiper"].filter(Boolean).join(", ") || "CSS-only";
    console.log(`  ${file.replace(".html", "").padEnd(30)} ${sizeKb}KB  [${libs}]  ${desc}`);
  }
  console.log(`\nUsage: --enhance-skeleton <name> [--domain X] [--colors Y] [--images Z] [--description T]`);
}

async function enhanceFromLibrary(skeletonName: string, domain: string, description?: string, colors?: string, images?: string) {
  const { existsSync } = await import("fs");
  const { resolve } = await import("path");

  // Allow with or without .html extension
  const fileName = skeletonName.endsWith(".html") ? skeletonName : `${skeletonName}.html`;
  const skeletonPath = resolve(__dirname, "skeletons", fileName);

  if (!existsSync(skeletonPath)) {
    console.error(`Skeleton not found: ${fileName}`);
    console.log("Available skeletons:");
    const skeletons = listSkeletons();
    for (const s of skeletons) console.log(`  ${s.replace(".html", "")}`);
    process.exit(1);
  }

  await enhanceSkeletonFile(skeletonPath, domain, description, colors, images, true);
}

// ─── Phase 3: Generate Premium Components ────────────────────────────────────

async function generateComponents(count: number, persona?: string, domain?: string, brandLockOpts?: { name: string; colors: string; fonts?: string; style?: string }) {
  const db = await getDb();
  // Get briefed sections ready for generation
  const query: Record<string, unknown> = {
    status: "briefed",
    animationBrief: { $exists: true },
  };
  if (domain) query.sourceDomain = domain;
  const docs = await db.collection("raw_sections").find(query).limit(count).toArray();

  if (docs.length === 0) {
    console.log("No briefed sections ready for generation. Run --brief first.");
    return;
  }

  if (brandLockOpts) {
    console.log(`Generating ${docs.length} premium components via Kimi K2.5 (brand-locked: ${brandLockOpts.name})...\n`);
  } else {
    console.log(`Generating ${docs.length} premium components via Kimi K2.5...\n`);
  }

  const { getRouter } = await import("../packages/sdk/src/utils/router.js");
  const {
    generateAutoSpec,
    generateComponent,
    scoreQualityStatic,
    normalizeHtml,
    qualityGate,
    buildComponentEntry,
  } = await import("../packages/sdk/src/utils/component-generator.js");
  const router = getRouter();

  const results = { accepted: 0, normalized: 0, rejected: 0, errors: 0 };

  // Build brand lock if provided
  const brandLock = brandLockOpts ? {
    name: brandLockOpts.name,
    colors: brandLockOpts.colors,
    fonts: brandLockOpts.fonts,
    style: brandLockOpts.style,
  } : undefined;

  for (const doc of docs) {
    const spec = generateAutoSpec(
      { ...doc, _id: doc._id.toString() } as any,
      brandLock ? undefined : persona, // skip persona if brand-locked
      brandLock,
    );

    console.log(`  [${doc.sourceDomain}] ${spec.category} (${spec.brief.animationStyle}, ${spec.persona})...`);

    try {
      // Generate component via Kimi K2.5
      const { html: rawHtml, tokensUsed } = await generateComponent(router, spec);

      if (!rawHtml || rawHtml.length < 100) {
        console.log(`    SKIP: empty response`);
        results.errors++;
        continue;
      }

      // Score quality (static — no Playwright needed)
      const report = scoreQualityStatic(rawHtml);
      const decision = qualityGate({ ...report, jsErrors: [] });

      let finalHtml = rawHtml;
      if (decision === "normalize") {
        finalHtml = normalizeHtml(rawHtml);
        // Re-score after normalization
        const newReport = scoreQualityStatic(finalHtml);
        const newDecision = qualityGate({ ...newReport, jsErrors: [] });
        if (newDecision === "reject") {
          console.log(`    REJECT: ${report.overall}/10 → normalized → ${newReport.overall}/10 (still too low)`);
          results.rejected++;
          await db.collection("raw_sections").updateOne({ _id: doc._id }, { $set: { status: "rejected", updatedAt: new Date() } });
          continue;
        }
        console.log(`    NORMALIZE: ${report.overall}/10 → ${newReport.overall}/10 [${newReport.tier}]`);
        results.normalized++;
      } else if (decision === "reject") {
        console.log(`    REJECT: ${report.overall}/10 — ${report.issues.slice(0, 3).join(", ")}`);
        results.rejected++;
        await db.collection("raw_sections").updateOne({ _id: doc._id }, { $set: { status: "rejected", updatedAt: new Date() } });
        continue;
      } else {
        console.log(`    ACCEPT: ${report.overall}/10 [${report.tier}] (${tokensUsed || "?"} tokens)`);
        results.accepted++;
      }

      // Build component entry
      const entry = buildComponentEntry(finalHtml, spec, { ...report, jsErrors: [] });

      // Save to generated_components collection
      await db.collection("generated_components").updateOne(
        { id: entry.id },
        { $set: { ...entry, generatedAt: new Date() } },
        { upsert: true },
      );

      // Mark raw section as processed
      await db.collection("raw_sections").updateOne({ _id: doc._id }, {
        $set: { status: "accepted", generatedComponentId: entry.id, updatedAt: new Date() },
      });

    } catch (err) {
      console.error(`    ERROR: ${err instanceof Error ? err.message : err}`);
      results.errors++;
    }
  }

  console.log(`\nResults: ${results.accepted} accepted, ${results.normalized} normalized, ${results.rejected} rejected, ${results.errors} errors`);
}

// ─── Phase 4: Merge to Component Library ─────────────────────────────────────

async function mergeToLibrary(preview: boolean) {
  const db = await getDb();
  const { readFileSync, writeFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");
  const { structuralHash } = await import("../packages/sdk/src/utils/section-extractor.js");
  const { hammingDistance } = await import("../packages/sdk/src/utils/component-generator.js");

  // Get all accepted generated components not yet merged
  const generated = await db.collection("generated_components").find({
    merged: { $ne: true },
  }).toArray();

  if (generated.length === 0) {
    console.log("No generated components to merge. Run --generate first.");
    return;
  }

  console.log(`Merging ${generated.length} components into library...\n`);

  // Load existing components.json
  const scriptDir = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
  const componentsPath = resolve(scriptDir, "components.json");
  let existing: any[] = [];
  if (existsSync(componentsPath)) {
    existing = JSON.parse(readFileSync(componentsPath, "utf-8"));
  }

  // Build structural hash set from existing components for dedup
  const existingHashes = new Set<string>();
  for (const c of existing) {
    if (c.html) existingHashes.add(structuralHash(c.html));
  }

  // Build visual hash set for visual dedup
  const existingVisualHashes: string[] = existing
    .filter((c: any) => c.visualHash)
    .map((c: any) => c.visualHash);

  let merged = 0;
  let skippedDup = 0;
  let skippedVisual = 0;

  for (const comp of generated) {
    // Structural dedup
    const hash = structuralHash(comp.html);
    if (existingHashes.has(hash)) {
      console.log(`  skip: ${comp.id} (structural duplicate)`);
      skippedDup++;
      await db.collection("generated_components").updateOne({ _id: comp._id }, { $set: { merged: true, skipReason: "structural-dup" } });
      continue;
    }

    // Visual dedup (if hash available)
    if (comp.visualHash && existingVisualHashes.length > 0) {
      const dupHash = existingVisualHashes.find(h => hammingDistance(comp.visualHash, h) < 8);
      if (dupHash) {
        console.log(`  skip: ${comp.id} (visual duplicate, hamming < 8)`);
        skippedVisual++;
        await db.collection("generated_components").updateOne({ _id: comp._id }, { $set: { merged: true, skipReason: "visual-dup" } });
        continue;
      }
    }

    if (preview) {
      console.log(`  [preview] ${comp.id} — ${comp.category} [${comp.qualityReport?.tier || "?"}] score: ${comp.qualityReport?.overall || "?"}/10`);
    } else {
      // Add to existing components
      existing.push({
        id: comp.id,
        category: comp.category,
        name: comp.name,
        description: comp.description,
        html: comp.html,
        tokens: comp.tokens,
        slots: [],
        variants: [],
        tags: comp.tags,
        source: comp.source,
        adaptability: comp.adaptability,
        quality: comp.quality,
        positiveRatings: 0,
        negativeRatings: 0,
        compositeScore: comp.compositeScore,
        elo: comp.elo,
        usageCount: 0,
        createdAt: comp.createdAt,
        updatedAt: comp.updatedAt,
      });

      existingHashes.add(hash);
      if (comp.visualHash) existingVisualHashes.push(comp.visualHash);

      await db.collection("generated_components").updateOne({ _id: comp._id }, { $set: { merged: true } });
      console.log(`  merge: ${comp.id} — ${comp.category} [${comp.qualityReport?.tier || "?"}]`);
    }
    merged++;
  }

  if (!preview && merged > 0) {
    writeFileSync(componentsPath, JSON.stringify(existing, null, 2));
    console.log(`\nWrote ${existing.length} total components to components.json`);
  }

  console.log(`\n${merged} merged, ${skippedDup} structural duplicates, ${skippedVisual} visual duplicates`);
}

// ─── Phase 4: Score existing generated components with Playwright ────────────

async function scoreWithPlaywright(count: number) {
  const db = await getDb();

  const docs = await db.collection("generated_components").find({
    "qualityReport.jsErrors": { $exists: false },
    merged: { $ne: true },
  }).limit(count).toArray();

  if (docs.length === 0) {
    console.log("No generated components to score.");
    return;
  }

  console.log(`Scoring ${docs.length} components with Playwright...\n`);

  const { scoreQualityFull, qualityGate } = await import("../packages/sdk/src/utils/component-generator.js");

  let passed = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      const report = await scoreQualityFull(doc.html);
      const decision = qualityGate(report);

      const symbol = decision === "accept" ? "OK" : decision === "normalize" ? "??" : "XX";
      console.log(`  [${symbol}] ${doc.id}: ${report.overall}/10 [${report.tier}] — ${report.jsErrors.length} JS errors${report.issues.length > 0 ? ` — ${report.issues[0]}` : ""}`);

      await db.collection("generated_components").updateOne({ _id: doc._id }, {
        $set: { qualityReport: report, updatedAt: new Date() },
      });

      if (decision === "reject") {
        await db.collection("generated_components").updateOne({ _id: doc._id }, {
          $set: { merged: true, skipReason: "quality-reject" },
        });
        failed++;
      } else {
        passed++;
      }
    } catch (err) {
      console.error(`  ERROR scoring ${doc.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} rejected`);
}

// ─── Preview: Export generated components as standalone HTML ─────────────────

async function previewComponents(count: number) {
  const db = await getDb();
  const { mkdirSync, writeFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");

  const scriptDir = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
  const previewDir = resolve(scriptDir, "engine-previews");
  if (!existsSync(previewDir)) mkdirSync(previewDir, { recursive: true });

  const docs = await db.collection("generated_components").find({}).sort({ generatedAt: -1 }).limit(count).toArray();

  if (docs.length === 0) {
    console.log("No generated components to preview. Run --generate first.");
    return;
  }

  console.log(`Exporting ${docs.length} components as preview HTML files...\n`);

  for (const doc of docs) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.name || doc.id}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"><\/script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
  <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet">
  <style>body{font-family:'Inter',sans-serif;margin:0;}</style>
</head>
<body class="bg-white">
<div class="h-[30vh] bg-gray-100 flex items-center justify-center flex-col gap-2">
  <p class="text-gray-400 text-sm">Scroll down to see component</p>
  <p class="text-gray-300 text-xs">${doc.category} | ${doc.qualityReport?.tier || "?"} | score: ${doc.qualityReport?.overall || "?"}/10</p>
</div>

${doc.html}

<div class="h-[50vh] bg-gray-50"></div>

<script>
window.addEventListener('load', function() {
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    setTimeout(function() { ScrollTrigger.refresh(); }, 200);
  }
});
<\/script>
</body>
</html>`;

    const filename = `${doc.id}.html`;
    const filepath = resolve(previewDir, filename);
    writeFileSync(filepath, html);
    console.log(`  ${filename} — ${doc.category} [${doc.qualityReport?.tier || "?"}] score: ${doc.qualityReport?.overall || "?"}/10`);
  }

  console.log(`\nPreview files saved to: ${previewDir}/`);
  console.log(`Open in browser: open ${previewDir}/`);
}

// ─── Phase 5: Continuous Pipeline + Rating Loop ─────────────────────────────

async function refreshStale(staleDays: number) {
  const db = await getDb();
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString();

  const stale = await db.collection("crawl_targets").find({
    status: "crawled",
    $or: [
      { lastCrawled: { $lt: cutoff } },
      { lastCrawled: { $exists: false } },
    ],
  }).sort({ lastCrawled: 1 }).toArray();

  if (stale.length === 0) {
    console.log(`No stale targets (all crawled within ${staleDays} days).`);
    return;
  }

  console.log(`Found ${stale.length} stale targets (last crawled >${staleDays}d ago). Re-crawling...\n`);

  // Reset to pending, then crawl
  for (const target of stale) {
    await db.collection("crawl_targets").updateOne(
      { domain: target.domain },
      { $set: { status: "pending" } },
    );
  }

  for (const target of stale) {
    try {
      await crawlDomain(target.domain);
    } catch (err) {
      console.error(`  Error re-crawling ${target.domain}: ${err instanceof Error ? err.message : err}`);
    }
    console.log();
  }
}

async function regenerateLow(count: number) {
  const db = await getDb();
  const { readFileSync, writeFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");

  const scriptDir = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
  const componentsPath = resolve(scriptDir, "components.json");
  if (!existsSync(componentsPath)) {
    console.log("No components.json found.");
    return;
  }

  const components: any[] = JSON.parse(readFileSync(componentsPath, "utf-8"));
  if (components.length === 0) {
    console.log("No components in library.");
    return;
  }

  // Group by category
  const byCategory = new Map<string, any[]>();
  for (const c of components) {
    const cat = c.category || "content";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(c);
  }

  console.log(`\n── Rating-driven Regeneration ──\n`);

  // Find categories with enough data
  let totalRemoved = 0;
  let totalQueued = 0;

  for (const [category, comps] of byCategory) {
    if (comps.length < 5) continue; // Need enough to compare

    // Sort by compositeScore (ascending — worst first)
    const sorted = comps.sort((a: any, b: any) => (a.compositeScore ?? a.quality ?? 3) - (b.compositeScore ?? b.quality ?? 3));

    // Bottom 10% are candidates for removal
    const bottomCount = Math.max(1, Math.floor(sorted.length * 0.1));
    const bottom = sorted.slice(0, bottomCount);

    // Top 3 as inspiration for regeneration
    const top = sorted.slice(-3).reverse();

    // Only remove if bottom scores are significantly lower than top
    const bottomAvg = bottom.reduce((s: number, c: any) => s + (c.compositeScore ?? c.quality ?? 3), 0) / bottom.length;
    const topAvg = top.reduce((s: number, c: any) => s + (c.compositeScore ?? c.quality ?? 3), 0) / top.length;

    if (topAvg - bottomAvg < 1) continue; // Not enough quality gap

    console.log(`  ${category}: ${bottom.length} low-quality (avg ${bottomAvg.toFixed(1)}) vs top avg ${topAvg.toFixed(1)}`);
    for (const b of bottom) {
      console.log(`    remove: ${b.id} (score: ${(b.compositeScore ?? b.quality ?? 3).toFixed(1)})`);
    }

    // Flag bottom for removal
    const removeIds = new Set(bottom.map((b: any) => b.id));
    totalRemoved += removeIds.size;

    // Queue regeneration briefs inspired by the top components
    // Save inspiration references to raw_sections for the generate pipeline
    for (const topComp of top.slice(0, 1)) { // Use top 1 as primary inspiration
      await db.collection("raw_sections").insertOne({
        sourceUrl: `library:${topComp.id}`,
        sourceDomain: "internal",
        industry: category,
        html: (topComp.html || "").slice(0, 10_000),
        htmlLength: topComp.html?.length || 0,
        textContent: topComp.description || "",
        classification: {
          category,
          confidence: 1,
          method: "heuristic",
          tier: topComp.tags?.includes("cinematic") ? "cinematic" : topComp.tags?.includes("animated") ? "animated" : "interactive",
          features: { hasAnimation: true, hasCta: false, hasImage: false, hasVideo: false, hasForm: false, hasCarousel: false, columnCount: 0, isInteractive: false },
        },
        animations: [],
        animationBrief: {
          sectionType: category,
          animationStyle: "regeneration-from-top",
          effects: [{ element: "all", animation: "inspired-by-top", trigger: "on-scroll-enter", timing: "gsap", detail: `Regeneration inspired by top-rated ${category}: ${topComp.name}` }],
          libraries: ["gsap", "ScrollTrigger"],
          complexity: "intermediate" as const,
        },
        structuralHash: `regen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        status: "briefed",
        extractedAt: new Date().toISOString(),
        createdAt: new Date(),
      });
      totalQueued++;
    }

    // Remove bottom components from the array
    const remaining = components.filter((c: any) => !removeIds.has(c.id));
    components.length = 0;
    components.push(...remaining);
  }

  if (totalRemoved > 0) {
    writeFileSync(componentsPath, JSON.stringify(components, null, 2));
    console.log(`\nRemoved ${totalRemoved} low-scoring components. Queued ${totalQueued} regeneration briefs.`);
    console.log(`Run --generate to create replacements.`);
  } else {
    console.log("\nNo categories have a significant quality gap. Nothing to regenerate.");
  }
}

async function gapAnalysis() {
  const db = await getDb();
  const { readFileSync, existsSync } = await import("fs");
  const { resolve } = await import("path");

  const scriptDir = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
  const componentsPath = resolve(scriptDir, "components.json");
  let components: any[] = [];
  if (existsSync(componentsPath)) {
    components = JSON.parse(readFileSync(componentsPath, "utf-8"));
  }

  // All categories we expect
  const expectedCategories = [
    "navbar", "hero", "features", "cards", "testimonials", "pricing",
    "cta", "footer", "forms", "stats", "team", "gallery", "faq",
    "carousel", "contact", "logos",
  ];
  const expectedTiers = ["basic", "interactive", "animated", "cinematic"];

  // Count by category + tier
  const matrix: Record<string, Record<string, { count: number; avgScore: number; scores: number[] }>> = {};
  for (const cat of expectedCategories) {
    matrix[cat] = {};
    for (const tier of expectedTiers) {
      matrix[cat][tier] = { count: 0, avgScore: 0, scores: [] };
    }
  }

  for (const c of components) {
    const cat = c.category || "content";
    if (!matrix[cat]) continue;
    const tier = c.tags?.find((t: string) => expectedTiers.includes(t)) || "basic";
    if (!matrix[cat][tier]) continue;
    matrix[cat][tier].count++;
    const score = c.compositeScore ?? c.quality ?? 3;
    matrix[cat][tier].scores.push(score);
  }

  // Compute averages
  for (const cat of expectedCategories) {
    for (const tier of expectedTiers) {
      const entry = matrix[cat][tier];
      if (entry.scores.length > 0) {
        entry.avgScore = Math.round(entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length * 10) / 10;
      }
    }
  }

  // Display
  console.log(`\n── Gap Analysis: ${components.length} components ──\n`);
  console.log(`${"Category".padEnd(16)} ${"Basic".padEnd(12)} ${"Interactive".padEnd(12)} ${"Animated".padEnd(12)} ${"Cinematic".padEnd(12)} Total`);
  console.log("─".repeat(76));

  const gaps: string[] = [];

  for (const cat of expectedCategories) {
    const parts: string[] = [cat.padEnd(16)];
    let total = 0;
    for (const tier of expectedTiers) {
      const e = matrix[cat][tier];
      total += e.count;
      const label = e.count > 0 ? `${e.count} (${e.avgScore})` : "—";
      parts.push(label.padEnd(12));

      // Identify gaps
      if (e.count === 0 && (tier === "animated" || tier === "cinematic")) {
        gaps.push(`${cat} — no ${tier} components`);
      } else if (e.count > 0 && e.avgScore < 3) {
        gaps.push(`${cat}/${tier} — low quality (avg ${e.avgScore})`);
      }
    }
    parts.push(String(total));
    console.log(parts.join(" "));
  }

  // Also check raw_sections for available patterns that haven't been generated
  const briefedCount = await db.collection("raw_sections").countDocuments({ status: "briefed" });
  const acceptedCount = await db.collection("raw_sections").countDocuments({ status: "accepted" });

  console.log(`\n── Pipeline Status ──\n`);
  console.log(`Briefed sections (ready to generate): ${briefedCount}`);
  console.log(`Accepted sections (already generated): ${acceptedCount}`);

  if (gaps.length > 0) {
    console.log(`\n── Gaps Found ──\n`);
    for (const g of gaps) console.log(`  ! ${g}`);
    console.log(`\nConsider: --inspire --category <cat> --tier <tier> --count 5`);
  } else {
    console.log("\nNo significant gaps found.");
  }
}

async function inspire(category: string, tier: string, count: number, persona?: string) {
  const db = await getDb();

  // Find top patterns for this category from the catalogue
  const patterns = await db.collection("animation_patterns").find({
    "pattern.type": { $in: tier === "cinematic" ? ["scrolltrigger", "gsap", "three-js"] : ["gsap", "scrolltrigger", "css-keyframes", "swiper"] },
  }).sort({ frequency: -1 }).limit(10).toArray();

  // Also look at top raw_sections for inspiration
  const topSections = await db.collection("raw_sections").find({
    "classification.category": category,
    "classification.tier": { $in: tier === "cinematic" ? ["cinematic", "animated"] : [tier, "animated", "cinematic"] },
    animationBrief: { $exists: true },
  }).sort({ "classification.confidence": -1 }).limit(5).toArray();

  console.log(`\n── Inspire: Generate ${count} ${tier} ${category} components ──\n`);
  console.log(`Found ${patterns.length} animation patterns, ${topSections.length} reference sections\n`);

  if (topSections.length === 0 && patterns.length === 0) {
    console.log("No patterns or reference sections found. Run --crawl-pending and --brief first.");
    return;
  }

  // Build few-shot examples from top sections' briefs
  const fewShotBriefs = topSections
    .filter(s => s.animationBrief)
    .map(s => s.animationBrief)
    .slice(0, 3);

  const patternDescriptions = patterns
    .map(p => `${p.pattern.type} (${p.pattern.trigger}): ${p.pattern.description} [seen on ${p.frequency} sites]`)
    .slice(0, 5)
    .join("\n");

  // Create synthetic briefed sections for the generate pipeline
  const personaId = persona || (tier === "cinematic" ? "editorial-luxury" : tier === "animated" ? "bold-modern" : "tech-minimal");

  for (let i = 0; i < count; i++) {
    const fewShot = fewShotBriefs[i % fewShotBriefs.length];
    const brief = fewShot || {
      sectionType: category,
      animationStyle: tier === "cinematic" ? "cinematic-scroll" : "scroll-reveal",
      effects: [
        { element: "heading", animation: "fade-up", trigger: "on-scroll-enter", timing: "0.8s power4.out", detail: "Main heading reveals from below with stagger" },
        { element: "content", animation: "stagger-fade", trigger: "on-scroll-enter", timing: "stagger: 0.1s", detail: "Content elements fade in sequentially" },
      ],
      libraries: ["gsap", "ScrollTrigger"],
      complexity: tier === "cinematic" ? "cinematic" : "intermediate",
    };

    await db.collection("raw_sections").insertOne({
      sourceUrl: `inspire:${category}:${tier}:${i}`,
      sourceDomain: "generated",
      industry: "multi",
      html: "",
      htmlLength: 0,
      textContent: `Inspired ${category} section #${i + 1}`,
      classification: {
        category,
        confidence: 1,
        method: "heuristic",
        tier,
        features: { hasAnimation: true, hasCta: true, hasImage: true, hasVideo: false, hasForm: false, hasCarousel: tier === "interactive", columnCount: 0, isInteractive: tier !== "basic" },
      },
      animations: [],
      animationBrief: {
        ...brief,
        sectionType: category,
        effects: [
          ...brief.effects,
          ...(patternDescriptions ? [{ element: "inspired", animation: "pattern-catalogue", trigger: "reference", timing: "n/a", detail: `Top patterns:\n${patternDescriptions}` }] : []),
        ],
      },
      structuralHash: `inspire-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: "briefed",
      extractedAt: new Date().toISOString(),
      createdAt: new Date(),
      _persona: personaId,
    });

    console.log(`  Queued ${category} #${i + 1} (${tier}, persona: ${personaId})`);
  }

  console.log(`\n${count} sections queued. Run --generate --count ${count} --persona ${personaId} to create them.`);
}

// ─── Phase 6: Smart Selection + Style Transfer ──────────────────────────────

async function styleTransfer(sourceCategory: string, targetPersona: string, count: number) {
  const db = await getDb();

  // Find top-rated animation briefs from the source category
  const topSections = await db.collection("raw_sections").find({
    "classification.category": sourceCategory,
    "classification.tier": { $in: ["animated", "cinematic"] },
    animationBrief: { $exists: true },
  }).sort({ "classification.confidence": -1 }).limit(count).toArray();

  if (topSections.length === 0) {
    console.log(`No animated ${sourceCategory} sections found. Run --crawl and --brief first.`);
    return;
  }

  console.log(`\n── Style Transfer: ${sourceCategory} patterns → ${targetPersona} persona ──\n`);

  for (let i = 0; i < topSections.length; i++) {
    const section = topSections[i];
    const brief = section.animationBrief;

    // Create a new section with the same animation brief but different persona
    await db.collection("raw_sections").insertOne({
      sourceUrl: `style-transfer:${sourceCategory}:${targetPersona}:${i}`,
      sourceDomain: section.sourceDomain || "transfer",
      industry: section.industry || "multi",
      html: "",
      htmlLength: 0,
      textContent: `Style transfer: ${sourceCategory} → ${targetPersona}`,
      classification: { ...section.classification },
      animations: section.animations || [],
      animationBrief: {
        ...brief,
        effects: [
          ...brief.effects,
          { element: "style-note", animation: "persona-override", trigger: "n/a", timing: "n/a", detail: `Apply ${targetPersona} persona styling to these animation patterns` },
        ],
      },
      structuralHash: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: "briefed",
      extractedAt: new Date().toISOString(),
      createdAt: new Date(),
      _persona: targetPersona,
    });

    console.log(`  [${i + 1}] ${section.sourceDomain} ${sourceCategory} (${brief.animationStyle}) → ${targetPersona}`);
  }

  console.log(`\n${topSections.length} transfer sections queued. Run --generate --persona ${targetPersona} to create them.`);
}

async function crossIndustry(fromIndustry: string, toCategory: string, persona: string, count: number) {
  const db = await getDb();

  // Find animated sections from the source industry
  const sourceSections = await db.collection("raw_sections").find({
    industry: fromIndustry,
    "classification.tier": { $in: ["animated", "cinematic"] },
    animationBrief: { $exists: true },
  }).sort({ "classification.confidence": -1 }).limit(count * 2).toArray();

  if (sourceSections.length === 0) {
    console.log(`No animated sections from "${fromIndustry}" industry. Run --crawl first.`);
    return;
  }

  console.log(`\n── Cross-Industry: ${fromIndustry} patterns → ${toCategory} (${persona}) ──\n`);

  let queued = 0;
  for (const section of sourceSections.slice(0, count)) {
    const brief = section.animationBrief;

    await db.collection("raw_sections").insertOne({
      sourceUrl: `cross-industry:${fromIndustry}:${toCategory}:${queued}`,
      sourceDomain: section.sourceDomain || "cross",
      industry: fromIndustry,
      html: "",
      htmlLength: 0,
      textContent: `Cross-industry: ${fromIndustry} → ${toCategory}`,
      classification: {
        category: toCategory,
        confidence: 0.9,
        method: "heuristic" as const,
        tier: section.classification.tier,
        features: section.classification.features,
      },
      animations: section.animations || [],
      animationBrief: {
        ...brief,
        sectionType: toCategory,
        effects: [
          ...brief.effects,
          { element: "cross-note", animation: "industry-transfer", trigger: "n/a", timing: "n/a", detail: `Apply ${fromIndustry} animation patterns to a ${toCategory} section` },
        ],
      },
      structuralHash: `cross-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: "briefed",
      extractedAt: new Date().toISOString(),
      createdAt: new Date(),
      _persona: persona,
    });
    queued++;
    console.log(`  [${queued}] ${section.sourceDomain} (${section.classification.category}) → ${toCategory} (${persona})`);
  }

  console.log(`\n${queued} cross-industry sections queued. Run --generate --persona ${persona} to create them.`);
}

async function detectTrends() {
  const db = await getDb();

  // Aggregate patterns by type, sorted by first-seen date (newest first)
  const recentPatterns = await db.collection("animation_patterns").aggregate([
    { $sort: { firstSeen: -1 } },
    { $group: {
      _id: "$pattern.type",
      totalFrequency: { $sum: "$frequency" },
      domains: { $addToSet: "$domain" },
      firstSeen: { $min: "$firstSeen" },
      lastSeen: { $max: "$lastSeen" },
      triggers: { $addToSet: "$pattern.trigger" },
      sampleDescriptions: { $push: "$pattern.description" },
    }},
    { $project: {
      type: "$_id",
      totalFrequency: 1,
      domainCount: { $size: "$domains" },
      firstSeen: 1,
      lastSeen: 1,
      triggers: 1,
      sampleDescription: { $first: "$sampleDescriptions" },
    }},
    { $sort: { totalFrequency: -1 } },
  ]).toArray();

  if (recentPatterns.length === 0) {
    console.log("No patterns detected yet. Run --crawl first.");
    return;
  }

  console.log(`\n── Animation Pattern Trends ──\n`);
  console.log(`${"Type".padEnd(25)} ${"Freq".padEnd(8)} ${"Domains".padEnd(8)} ${"Triggers".padEnd(25)} First Seen`);
  console.log("─".repeat(85));

  for (const p of recentPatterns) {
    console.log(
      `${(p.type || "").padEnd(25)} ${String(p.totalFrequency).padEnd(8)} ${String(p.domainCount).padEnd(8)} ${(p.triggers || []).join(", ").padEnd(25)} ${p.firstSeen || "?"}`,
    );
  }

  // Identify emerging patterns (new CSS features)
  const emergingTypes = ["scroll-driven", "view-transitions", "css-keyframes"];
  const emerging = recentPatterns.filter(p => emergingTypes.includes(p.type));

  if (emerging.length > 0) {
    console.log(`\n── Emerging Patterns ──\n`);
    for (const e of emerging) {
      console.log(`  ${e.type}: ${e.totalFrequency} occurrences across ${e.domainCount} domains`);
      if (e.sampleDescription) console.log(`    Example: ${e.sampleDescription}`);
    }
  }

  // Tier distribution from raw_sections
  const tierDist = await db.collection("raw_sections").aggregate([
    { $group: { _id: "$classification.tier", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  if (tierDist.length > 0) {
    const total = tierDist.reduce((s, r) => s + (r.count as number), 0);
    console.log(`\n── Tier Distribution (${total} sections) ──\n`);
    for (const r of tierDist) {
      const pct = Math.round((r.count as number) / total * 100);
      const bar = "█".repeat(Math.round(pct / 2));
      console.log(`  ${String(r._id).padEnd(15)} ${String(r.count).padEnd(6)} ${pct}% ${bar}`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  try {
    if (args["seed-targets"]) {
      await seedTargets();
    } else if (args["list-targets"]) {
      await listTargets();
    } else if (args["crawl"] && typeof args["crawl"] === "string") {
      await crawlDomain(args["crawl"]);
    } else if (args["crawl-pending"]) {
      const count = typeof args["count"] === "string" ? parseInt(args["count"]) : 999;
      await crawlPending(count);
    } else if (args["classify"]) {
      await classifyLowConfidence();
    } else if (args["brief"]) {
      const count = typeof args["count"] === "string" ? parseInt(args["count"]) : 10;
      await generateBriefs(count);
    } else if (args["catalogue"]) {
      await showCatalogue();
    } else if (args["generate"]) {
      const count = typeof args["count"] === "string" ? parseInt(args["count"]) : 5;
      const persona = typeof args["persona"] === "string" ? args["persona"] : undefined;
      const domain = typeof args["domain"] === "string" ? args["domain"] : undefined;
      const brandName = typeof args["brand-lock"] === "string" ? args["brand-lock"] : undefined;
      const brandColors = typeof args["brand-colors"] === "string" ? args["brand-colors"] : undefined;
      const brandFonts = typeof args["brand-fonts"] === "string" ? args["brand-fonts"] : undefined;
      const brandStyle = typeof args["brand-style"] === "string" ? args["brand-style"] : undefined;
      const brandLock = brandName && brandColors ? { name: brandName, colors: brandColors, fonts: brandFonts, style: brandStyle } : undefined;
      await generateComponents(count, persona, domain, brandLock);
    } else if (args["enhance"]) {
      const file = typeof args["enhance"] === "string" ? args["enhance"] : undefined;
      const domain = typeof args["domain"] === "string" ? args["domain"] : "skeleton";
      const colors = typeof args["colors"] === "string" ? args["colors"] : undefined;
      const images = typeof args["images"] === "string" ? args["images"] : undefined;
      const desc = typeof args["description"] === "string" ? args["description"] : undefined;
      const cssOnly = !args["full-html"]; // default CSS-only, --full-html for legacy
      await enhanceSkeletonFile(file!, domain, desc, colors, images, cssOnly);
    } else if (args["list-skeletons"]) {
      await showSkeletons();
    } else if (args["enhance-skeleton"]) {
      const name = typeof args["enhance-skeleton"] === "string" ? args["enhance-skeleton"] : undefined;
      if (!name) { console.error("Usage: --enhance-skeleton <name>"); process.exit(1); }
      const domain = typeof args["domain"] === "string" ? args["domain"] : "skeleton";
      const colors = typeof args["colors"] === "string" ? args["colors"] : undefined;
      const images = typeof args["images"] === "string" ? args["images"] : undefined;
      const desc = typeof args["description"] === "string" ? args["description"] : undefined;
      await enhanceFromLibrary(name, domain, desc, colors, images);
    } else if (args["score"]) {
      const count = typeof args["count"] === "string" ? parseInt(args["count"]) : 10;
      await scoreWithPlaywright(count);
    } else if (args["merge"]) {
      const preview = args["preview"] === true;
      await mergeToLibrary(preview);
    } else if (args["list-personas"]) {
      const { listAvailablePersonas } = await import("../packages/sdk/src/utils/component-generator.js");
      const personas = listAvailablePersonas();
      console.log(`\n${personas.length} available personas:\n`);
      for (const p of personas) console.log(`  ${p}`);
      console.log(`\nUsage: --generate --persona ${personas[0]}`);
    } else if (args["preview"]) {
      const count = typeof args["count"] === "string" ? parseInt(args["count"]) : 10;
      await previewComponents(count);
    } else if (args["refresh"]) {
      const days = typeof args["days"] === "string" ? parseInt(args["days"]) : 30;
      await refreshStale(days);
    } else if (args["regenerate-low"]) {
      const count = typeof args["count"] === "string" ? parseInt(args["count"]) : 10;
      await regenerateLow(count);
    } else if (args["gap-analysis"]) {
      await gapAnalysis();
    } else if (args["inspire"]) {
      const category = typeof args["category"] === "string" ? args["category"] : "hero";
      const tier = typeof args["tier"] === "string" ? args["tier"] : "animated";
      const count = typeof args["count"] === "string" ? parseInt(args["count"]) : 5;
      const persona = typeof args["persona"] === "string" ? args["persona"] : undefined;
      await inspire(category, tier, count, persona);
    } else if (args["style-transfer"]) {
      const source = typeof args["category"] === "string" ? args["category"] : "hero";
      const persona = typeof args["persona"] === "string" ? args["persona"] : "tech-minimal";
      const count = typeof args["count"] === "string" ? parseInt(args["count"]) : 3;
      await styleTransfer(source, persona, count);
    } else if (args["cross-industry"]) {
      const from = typeof args["from"] === "string" ? args["from"] : "fashion";
      const to = typeof args["to"] === "string" ? args["to"] : "pricing";
      const persona = typeof args["persona"] === "string" ? args["persona"] : "tech-minimal";
      const count = typeof args["count"] === "string" ? parseInt(args["count"]) : 3;
      await crossIndustry(from, to, persona, count);
    } else if (args["trends"]) {
      await detectTrends();
    } else if (args["cleanup-screenshots"]) {
      const dir = typeof args["cleanup-screenshots"] === "string" ? args["cleanup-screenshots"] : undefined;
      await cleanupScreenshots(dir);
    } else if (args["stats"]) {
      await showStats();
    } else {
      console.log(`Component Engine CLI

Usage:
  npx tsx scripts/component-engine.ts <command> [options]

Phase 1-2: Crawl + Extract + Classify
  --seed-targets              Seed the crawl target list (FTSE 100, S&P 500, etc.)
  --list-targets              List all crawl targets and their status
  --crawl <domain>            Crawl a specific domain
  --crawl-pending [--count N] Crawl all (or N) pending targets
  --classify                  LLM-classify sections with low heuristic confidence
  --brief [--count N]         Generate animation briefs for animated sections
  --catalogue                 Show animation pattern catalogue (frequency, domains)

Phase 3: Generate Premium Components
  --generate [--count N]      Generate premium components from briefed sections
  --generate --persona <id>   Use a specific persona (52 available — run --list-personas)
  --generate --domain <d>     Generate only from a specific domain
  --generate --brand-lock <name> --brand-colors "<hex,hex,...>" [--brand-fonts "<fonts>"] [--brand-style "<desc>"]
                              Lock generation to a specific brand palette (bypasses persona)
  --enhance <file.html>       Enhance a skeleton HTML file (CSS-only by default — safe mode)
    [--domain <name>]         Source domain label (default: "skeleton")
    [--colors <palette>]      Color palette description
    [--images <style>]        Image style description
    [--description <text>]    Component description
    [--full-html]             Legacy mode: Kimi rewrites full HTML (may break animations)
  --list-skeletons            List available skeleton patterns in the library
  --enhance-skeleton <name>   Enhance a skeleton from the library (CSS-only, safe)
  --list-personas             List all 52 available personas
  --score [--count N]         Score generated components with Playwright (JS errors, responsive)

Phase 4: Normalize + Dedup + Merge
  --merge                     Merge accepted components into components.json (with dedup)
  --merge --preview           Preview what would be merged without writing
  --preview [--count N]       Export generated components as standalone HTML files for browser preview

Phase 5: Continuous Pipeline + Rating Loop
  --refresh [--days N]        Re-crawl targets not crawled in N days (default: 30)
  --regenerate-low            Remove bottom 10% ELO components, queue replacements from top-rated
  --gap-analysis              Show category/tier coverage matrix and identify gaps
  --inspire --category <cat> --tier <tier> [--count N] [--persona <id>]
                              Generate N components inspired by top patterns for a category

Phase 6: Smart Selection + Style Transfer
  --style-transfer --category <cat> --persona <id> [--count N]
                              Apply different persona to top animation patterns
  --cross-industry --from <industry> --to <category> --persona <id> [--count N]
                              Apply one industry's patterns to a different category
  --trends                    Show animation pattern trends and emerging techniques

General
  --cleanup-screenshots [dir] Remove screenshot images to save disk space (default: adidas-screenshots/)
  --stats                     Show engine stats (totals, by tier, by category)
`);
    }
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
