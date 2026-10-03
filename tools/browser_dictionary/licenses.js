(function () {
  "use strict";
  const container = document.getElementById("source-licenses");
  if (!container) return;
  const sources = globalThis.PALI_DICTIONARY?.sources;
  if (!sources) {
    container.textContent = "Source notices are unavailable. Rebuild data.js and reload this page.";
    return;
  }
  const detailed = container.dataset.detailed === "true";
  function paragraph(parent, text) {
    if (!text) return;
    const node = document.createElement("p");
    node.textContent = text;
    parent.append(node);
  }
  function link(parent, label, url, license = false) {
    if (!url) return;
    const node = document.createElement("a");
    node.textContent = label;
    node.href = url;
    if (license) node.rel = "license";
    const line = document.createElement("p");
    line.append(node);
    parent.append(line);
  }
  container.replaceChildren();
  for (const [source, notice] of Object.entries(sources)) {
    const section = document.createElement("section");
    section.dataset.licenseSource = source;
    const heading = document.createElement(detailed ? "h2" : "h3");
    heading.textContent = `${notice.title || source} (${source})`;
    section.append(heading);
    paragraph(section, notice.creator ? `Creator: ${notice.creator}.` : "");
    paragraph(section, notice.copyright);
    link(section, notice.license || "License unconfirmed", notice.licenseUrl, true);
    paragraph(section, notice.licenseNotice);
    link(section, "Full license and warranty disclaimer", notice.localLicenseFile);
    if (detailed) {
      link(section, "Original source", notice.sourceUrl);
      link(section, "Input data", notice.distributionUrl);
      link(section, "Upstream license", notice.upstreamLicenseUrl);
      link(section, "Full license text", notice.licenseTextUrl, true);
      link(section, "Licensing policy", notice.policyUrl);
      paragraph(section, notice.databaseRightsNotice);
      paragraph(section, notice.disclaimer);
      paragraph(section, notice.provenance);
      paragraph(section, notice.modifications ? `Modifications: ${notice.modifications}` : "");
      paragraph(section, notice.sha256 ? `Input SHA-256: ${notice.sha256}` : "");
    }
    container.append(section);
  }
})();