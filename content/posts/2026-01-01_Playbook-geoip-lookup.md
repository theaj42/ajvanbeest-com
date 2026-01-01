---
title: "Playbook: Find the Geolocation of an External IP Address"
date: 2026-01-01
author: ["AJ Van Beest", "Claude"]
tags: ["security", "playbooks", "geoip", "osint", "investigation"]
draft: false
---

# Playbook: Find the Geolocation of an External IP Address

## Purpose

Determine the geographic location of an external IP address using multiple sources, and validate that the results are consistent.


## Required Tools & Access

| Tool | Access Needed | Free Tier? | Notes |
|------|---------------|------------|-------|
| [IPinfo.io](https://ipinfo.io) | API token or web interface | Yes (50k/month) | Privacy detection requires paid plan |
| [ip-api.com](http://ip-api.com) | No auth for non-commercial | Yes | Includes proxy/hosting flags |
| [VirusTotal](https://virustotal.com) | API key or web interface | Yes (limited) | |
| [AbuseIPDB](https://abuseipdb.com) | API key or web interface | Yes (1k/day) | Tor/proxy detection |
| [Tor Exit Node List](https://check.torproject.org/torbulkexitlist) | None | Yes | Official Tor Project list |

You need at least two geolocation sources to cross-validate results.


## Input

- One external IPv4 or IPv6 address (e.g., `8.8.8.8`)


## Steps

### 1. Query IPinfo.io

**Web interface:**
1. Go to https://ipinfo.io
2. Enter the IP address in the search box
3. Record: City, Region, Country, Organization, ASN

**API:**
```bash
curl "https://ipinfo.io/{IP_ADDRESS}?token={YOUR_TOKEN}"
```

Record the following fields:
- `city`
- `region`
- `country`
- `org`
- `asn`


### 2. Query ip-api.com

**Web interface:**
1. Go to http://ip-api.com
2. The IP appears in the URL; modify to: `http://ip-api.com/json/{IP_ADDRESS}`
3. Record: City, Region, Country, ISP, AS

**API:**
```bash
curl "http://ip-api.com/json/{IP_ADDRESS}"
```

Record the following fields:
- `city`
- `regionName`
- `country`
- `isp`
- `as`


### 3. Query VirusTotal (optional but recommended)

**Web interface:**
1. Go to https://virustotal.com
2. Click "Search" and enter the IP address
3. Go to the "Details" tab
4. Record: Country, ASN, Network

**API:**
```bash
curl --header "x-apikey: {YOUR_API_KEY}" \
  "https://www.virustotal.com/api/v3/ip_addresses/{IP_ADDRESS}"
```

Record from `data.attributes`:
- `country`
- `asn`
- `as_owner`


### 4. Check for VPN/Proxy/Tor

This step determines whether the IP is masking its true origin.

#### 4a. Check ip-api.com flags

If you queried ip-api.com in Step 2, check these additional fields in the response:
- `proxy`: true/false (detects proxy/VPN)
- `hosting`: true/false (datacenter/hosting provider, often indicates VPN)

**API (with extra fields):**
```bash
curl "http://ip-api.com/json/{IP_ADDRESS}?fields=status,country,city,isp,as,proxy,hosting"
```

#### 4b. Check AbuseIPDB

**Web interface:**
1. Go to https://abuseipdb.com
2. Enter the IP address
3. Look for: Usage Type, ISP, and "Is Tor" flag

**API:**
```bash
curl -G "https://api.abuseipdb.com/api/v2/check" \
  --data-urlencode "ipAddress={IP_ADDRESS}" \
  -H "Key: {YOUR_API_KEY}" \
  -H "Accept: application/json"
```

Record from response:
- `data.usageType` (e.g., "Data Center/Web Hosting/Transit")
- `data.isTor` (true/false)
- `data.totalReports` (abuse report count)

#### 4c. Check Tor Exit Node List

**Manual check:**
1. Download the list: https://check.torproject.org/torbulkexitlist
2. Search for the IP address in the file
3. If found, the IP is a known Tor exit node

**Command line:**
```bash
curl -s "https://check.torproject.org/torbulkexitlist" | grep -q "{IP_ADDRESS}" && echo "TOR EXIT NODE" || echo "Not a Tor exit"
```

#### Summary: Privacy/Anonymization Flags

| Check | Result |
|-------|--------|
| ip-api proxy flag | |
| ip-api hosting flag | |
| AbuseIPDB usageType | |
| AbuseIPDB isTor | |
| Tor exit node list | |

**Interpretation:**
- **Tor exit node**: Location data is meaningless; this is the exit point, not the user
- **Proxy/VPN detected**: Location may be the VPN endpoint, not the user
- **Hosting/Datacenter**: Likely a server, VPN endpoint, or automated traffic—not a typical end user


## Validation

Compare the results from each source:

| Field | IPinfo.io | ip-api.com | VirusTotal |
|-------|-----------|------------|------------|
| Country | | | |
| City/Region | | | |
| ASN/Org | | | |

**Validation checks:**

1. **Country match**: Do all sources agree on the country?
   - If YES: High confidence in country-level location
   - If NO: Flag discrepancy; IP may use anycast or be misattributed

2. **City/Region match**: Do at least 2 sources agree on city or region?
   - If YES: Reasonable confidence in city-level location
   - If NO: Report country only; city-level data is unreliable for this IP

3. **ASN/Org match**: Do the ASN numbers match?
   - If YES: Confirms the network owner
   - If NO: Investigate further; one source may have stale data

**Known limitations:**
- VPNs, proxies, and Tor exit nodes will show the endpoint location, not the user (Step 4 helps detect these)
- CDN and anycast IPs (e.g., Cloudflare, Google) may return multiple valid locations
- Mobile IPs may geolocate to carrier headquarters, not actual user location
- Privacy detection is not perfect; some VPNs use residential IPs that evade detection


## Output

Produce a summary in this format:

```
IP Address: {IP}
Lookup Date: {YYYY-MM-DD}

Location:
  Country: {country} (confidence: high/medium/low)
  City/Region: {city, region} (confidence: high/medium/low)

Network:
  ASN: {asn}
  Organization: {org name}

Privacy/Anonymization:
  Tor Exit Node: {yes/no}
  Proxy/VPN Detected: {yes/no/unknown}
  Hosting/Datacenter: {yes/no}
  ⚠️ Location Reliability: {reliable / unreliable - anonymized}

Validation:
  Sources queried: {list sources}
  Country consensus: {yes/no}
  City consensus: {yes/no}

Notes:
  {any discrepancies or flags}
```

**Important:** If any privacy/anonymization flag is positive, add a warning that the geolocation data represents the proxy/VPN/Tor endpoint, NOT the actual user location.


## Logging

Record the following in your investigation log or ticket:

1. The IP address queried
2. Date/time of lookup
3. Sources consulted
4. **Location results**: Country, City/Region, confidence level
5. **Network info**: ASN, Organization
6. **Privacy flags**: Tor, Proxy/VPN, Hosting/Datacenter
7. Location reliability assessment
8. Any discrepancies noted
9. Analyst name or "automated" if run by script

**Example log entry:**
```
[2026-01-01 14:30] GeoIP lookup for 203.0.113.42
Sources: IPinfo.io, ip-api.com, VirusTotal, AbuseIPDB, Tor list
Result: Netherlands, Amsterdam (high confidence)
ASN: AS12345 - Example Hosting Inc.
Privacy: Not Tor, no proxy detected, hosting=yes (datacenter IP)
Notes: All geo sources agree. Datacenter IP suggests server or VPN endpoint.
Analyst: AJ
```


## Automation Notes

This playbook is a good candidate for scripting because:
- All steps are deterministic
- APIs return structured data
- Validation logic is straightforward

A script should:
1. Accept IP as input
2. Query all configured sources
3. Compare results automatically
4. Output the summary format above
5. Flag discrepancies for human review
