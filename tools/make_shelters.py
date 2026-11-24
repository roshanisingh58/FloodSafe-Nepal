"""Build backend/data/shelters.csv from the UN/IOM (2011) 'Identification of Open Spaces for
Humanitarian Purposes in Kathmandu Valley' report. Capacity = area / 45 m2 per person (Sphere camp
minimum); for grouped sites the group area is split equally. Ring Road strips and sites with
missing or misprinted coordinates are left out."""
import csv, re, sys
SRC = "UN/IOM 2011 Open Spaces for Humanitarian Purposes"
def dms(s):
    d, m, x = map(float, re.findall(r"[\d.]+", s)[:3]); return round(d + m / 60 + x / 3600, 6)
# (group area m2, flood_prone, [(name, lat DMS, lon DMS, municipality)])
G = [
 (305470, "no", [("National Agriculture Research Centre (NARC), Khumaltar", "27 39 11.68", "85 19 30.13", "Lalitpur")]),
 (155400, "no", [("Tundikhel and Ratna Park", "27 42 09.90", "85 18 55.02", "Kathmandu")]),
 (253327, "no", [("Royal Nepal Golf Club", "27 42 09.59", "85 21 16.00", "Kathmandu")]),
 (146575, "no", [("Civil Aviation 2 (south end of airport)", "27 40 29.42", "85 20 42.01", "Kathmandu")]),
 (134564, "no", [("Birendra Sainik School", "27 40 20.24", "85 25 03.91", "Bhaktapur")]),
 (63077, "no", [("RONAST, Satdobato", "27 39 23.49", "85 19 41.12", "Lalitpur"), ("ANFA Football Ground, Satdobato", "27 39 43.10", "85 19 50.50", "Lalitpur")]),
 (44877, "yes", [("Gokul Chaur, Balkumari", "27 40 18.23", "85 20 01.80", "Lalitpur"), ("ANFA Football Ground, Balkumari", "27 40 40.20", "85 20 03.97", "Lalitpur"), ("Bagmati Corridor 6", "27 40 45.64", "85 20 03.19", "Lalitpur")]),
 (71824, "no", [("St. Xavier's School, Jawalakhel", "27 40 27.33", "85 18 46.34", "Lalitpur"), ("St. Mary's School, Jawalakhel", "27 40 29.77", "85 18 38.85", "Lalitpur"), ("Jawalakhel Football Ground", "27 40 20.90", "85 18 45.58", "Lalitpur"), ("Tibetan Refugee Camp, Jawalakhel", "27 40 03.05", "85 18 37.77", "Lalitpur")]),
 (11676, "no", [("Madan Smarak School, Pulchowk", "27 40 36.02", "85 19 05.84", "Lalitpur"), ("Lalitpur Municipality Office", "27 40 33.38", "85 19 02.69", "Lalitpur")]),
 (112422, "no", [("Pulchowk Engineering College 1", "27 40 57.35", "85 19 23.05", "Lalitpur"), ("Pulchowk Engineering College 2", "27 40 50.77", "85 19 04.70", "Lalitpur"), ("UN Park, Jwagal", "27 41 08.52", "85 19 32.72", "Lalitpur"), ("Patan College", "27 40 45.40", "85 19 19.16", "Lalitpur")]),
 (49818, "no", [("Lagankhel Football Ground", "27 39 52.99", "85 19 15.59", "Lalitpur"), ("Lagankhel Stupa", "27 39 54.86", "85 19 23.25", "Lalitpur")]),
 (209491, "yes", [("Bagmati Corridor 1", "27 40 13.30", "85 17 31.05", "Kathmandu"), ("Bagmati Corridor 2", "27 40 22.02", "85 17 31.01", "Kathmandu"), ("Bagmati Corridor 3", "27 40 29.20", "85 17 36.06", "Kathmandu"), ("Modern Indian School", "27 40 00.67", "85 17 50.72", "Lalitpur"), ("Himal Cement Company", "27 39 16.99", "85 17 28.71", "Kathmandu")]),
 (13494, "no", [("Bhrikutimandap", "27 42 03.29", "85 19 04.37", "Kathmandu"), ("Rastriya Sabha Griha", "27 42 08.84", "85 19 02.61", "Kathmandu"), ("Balmiki Vidyapith", "27 42 09.95", "85 19 15.00", "Kathmandu")]),
 (11220, "no", [("Padma Kanya Campus, Bagbazar", "27 42 23.54", "85 19 15.66", "Kathmandu"), ("Nepal Academy, Kamaladi", "27 42 31.40", "85 19 14.83", "Kathmandu")]),
 (41172, "no", [("Nagpokhari Junction, Naxal", "27 42 53.10", "85 19 32.03", "Kathmandu"), ("Nepal Bal Mandir, Naxal", "27 42 49.19", "85 19 54.05", "Kathmandu"), ("Sano Gaucharan", "27 42 43.95", "85 19 59.48", "Kathmandu"), ("Sifal Ground", "27 42 40.63", "85 20 27.78", "Kathmandu")]),
 (99383, "yes", [("Pashupati 1", "27 42 22.97", "85 20 53.82", "Kathmandu"), ("Pashupati 2", "27 42 14.31", "85 21 02.42", "Kathmandu"), ("Pashupati 3", "27 42 42.86", "85 20 54.77", "Kathmandu"), ("Pashupati 4", "27 42 30.13", "85 20 51.47", "Kathmandu"), ("Pashupati 5", "27 42 31.61", "85 20 47.21", "Kathmandu"), ("Bhandarkhal, Pashupati", "27 42 33.95", "85 20 45.55", "Kathmandu"), ("DWSS ground, Pashupati", "27 42 38.32", "85 21 21.12", "Kathmandu")]),
 (91137, "no", [("Civil Aviation 1, Sinamangal", "27 41 54.55", "85 21 13.59", "Kathmandu"), ("Civil Aviation 3, Sinamangal", "27 41 36.76", "85 21 11.19", "Kathmandu"), ("Tinkune open space", "27 41 07.40", "85 20 55.72", "Kathmandu"), ("Airport Central Dojo", "27 41 54.29", "85 21 17.53", "Kathmandu")]),
 (95390, "no", [("Social Welfare Council, Lainchaur", "27 42 59.97", "85 18 55.50", "Kathmandu"), ("Election Commission Office, Bahadur Bhawan", "27 42 43.44", "85 18 53.23", "Kathmandu")]),
 (108021, "yes", [("Bagmati Corridor 4, Teku", "27 41 33.16", "85 18 12.62", "Kathmandu"), ("Bagmati Corridor 5, Teku", "27 41 32.35", "85 18 38.90", "Kathmandu"), ("UN Park, Gusingal", "27 41 28.09", "85 18 45.96", "Lalitpur"), ("Dasarath Stadium", "27 41 41.92", "85 18 54.84", "Kathmandu")]),
 (105367, "no", [("Shankha Park, Dhumbarahi", "27 44 00.19", "85 20 33.24", "Kathmandu"), ("Hyatt Regency grounds, Boudha", "27 43 12.35", "85 21 12.34", "Kathmandu")]),
 (55859, "no", [("Sallaghari, Bhaktapur", "27 40 26.93", "85 24 22.13", "Bhaktapur")]),
 (5778, "no", [("Taumadhi Square", "27 40 16.27", "85 25 45.46", "Bhaktapur"), ("Talako", "27 40 13.82", "85 25 38.12", "Bhaktapur"), ("Nasamana", "27 40 12.91", "85 25 38.30", "Bhaktapur"), ("Bhelukhel", "27 40 08.97", "85 25 46.80", "Bhaktapur")]),
 (18841, "no", [("Bhaktapur Durbar Square", "27 40 23.25", "85 25 42.79", "Bhaktapur"), ("Padma High School", "27 40 22.68", "85 25 38.72", "Bhaktapur"), ("Vidyarthi Niketan", "27 40 21.00", "85 25 48.97", "Bhaktapur")]),
 (23512, "no", [("Khwopa College", "27 40 37.65", "85 25 58.61", "Bhaktapur"), ("Basu School", "27 40 41.25", "85 25 46.30", "Bhaktapur")]),
 (8080, "no", [("Khwopa Engineering College", "27 40 14.02", "85 26 21.12", "Bhaktapur")]),
 (38115, "no", [("Bhaktapur Bahumukhi Campus", "27 40 12.34", "85 25 10.46", "Bhaktapur")]),
 (10793, "no", [("Maheshwori Football Ground", "27 40 11.31", "85 26 07.20", "Bhaktapur"), ("Adarsha Azad Higher Secondary School", "27 40 04.83", "85 25 55.31", "Bhaktapur")]),
]
rows, seen = [], set()
for area, fp, sites in G:
    for n, la, lo, mun in sites:
        lat, lon = dms(la), dms(lo)
        if (lat, lon) in seen: continue
        seen.add((lat, lon)); a = area / len(sites)
        rows.append(dict(name=n, lat=lat, lon=lon, type="open_space", capacity=int(a / 45), source=SRC, area_m2=int(a), flood_prone=fp, municipality=mun))
w = csv.DictWriter(open(sys.argv[1], "w", newline="", encoding="utf-8"), fieldnames=list(rows[0]))
w.writeheader(); w.writerows(rows); print(len(rows), "shelters written")
