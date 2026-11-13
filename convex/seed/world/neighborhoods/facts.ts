import type { CampusSeed, CorridorSeed, SourceSnapshot } from "../../types";

/**
 * Hand-curated nightlife corridors and campuses (#15), each citing pages that were
 * fetched and checked: official sources first (SF Planning, sf.gov, the
 * institutions), Wikipedia only alongside or where nothing official says it.
 * Snippets are verbatim. Coordinates are OpenStreetMap lookups of the cross
 * streets or campus. The seed files each corridor under every neighborhood it
 * passes through.
 */

/** Source snapshots, one per quoted passage, keyed by URL + passage hash. */
export const LANDMARK_SOURCES: Record<string, SourceSnapshot> = {
  "https://www.sf.gov/valencia-street-entertainment-zone#47234a4d": {
    url: "https://www.sf.gov/valencia-street-entertainment-zone",
    title: "Valencia Street Entertainment Zone",
    publisher: "SF.gov (Office of Economic and Workforce Development)",
    snippet:
      "The Valenica Street Entertainment Zone is on Valencia Street between 16th Street and 21st Street, and is active seven days a week from 12:00 PM – 11:59 PM.",
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/Mission_District,_San_Francisco#949fbcd1": {
    url: "https://en.wikipedia.org/wiki/Mission_District,_San_Francisco",
    title: "Mission District, San Francisco",
    publisher: "Wikipedia",
    snippet:
      "…the Valencia corridor (Valencia St, from about 15th to 22nd)…very popular destinations for their restaurants, bars, galleries and street life.",
    fetchedAt: 1794526026000,
  },
  "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#2753ab02": {
    url: "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco",
    title: "The Best Streets for Bar Hopping in San Francisco",
    publisher: "San Francisco Travel Association",
    snippet:
      "For live local acts, try The Chapel (777 Valencia St.) or The Valencia Room (647 Valencia St.), which sports a cozy bar downstairs and live music above.",
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/Polk_Street#ada03fcf": {
    url: "https://en.wikipedia.org/wiki/Polk_Street",
    title: "Polk Street",
    publisher: "Wikipedia",
    snippet:
      "Polk Gulch is the neighborhood around a section of Polk Street…from approximately Geary Street to Union Street.",
    fetchedAt: 1794526026000,
  },
  "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#c297b864": {
    url: "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco",
    title: "The Best Streets for Bar Hopping in San Francisco",
    publisher: "San Francisco Travel Association",
    snippet: "Polk Street is a full city sampler perfect for bar hopping the entire night away.",
    fetchedAt: 1794526026000,
  },
  "https://www.sf.gov/perfect-day-along-polk-st#a8bc2e80": {
    url: "https://www.sf.gov/perfect-day-along-polk-st",
    title: "Perfect Day along Polk St.",
    publisher: "SF.gov (Office of Economic and Workforce Development)",
    snippet: "Polk St. is a central area full of shops, restaurants, and entertainment.",
    fetchedAt: 1794526026000,
  },
  "https://www.sf.gov/perfect-day-soma-west#b846f4ec": {
    url: "https://www.sf.gov/perfect-day-soma-west",
    title: "Perfect Day in SoMa West",
    publisher: "SF.gov (Office of Economic and Workforce Development)",
    snippet:
      "…the 11th Street corridor at DNA Lounge, Buzzworks, Butter, Bella, Audio Nightclub, Halcyon, and Eve;…start at 1015 Folsom…",
    fetchedAt: 1794526026000,
  },
  "https://www.sf.gov/folsom-street-entertainment-zone#99401d95": {
    url: "https://www.sf.gov/folsom-street-entertainment-zone",
    title: "Folsom Street Entertainment Zone",
    publisher: "SF.gov (Office of Economic and Workforce Development)",
    snippet:
      "Folsom Street between 7th Street and 8th Street, and portions of Hallam Street and Langton Street Business Spotlight Cat Club Raven Bar F8 Nightclub & Bar",
    fetchedAt: 1794526026000,
  },
  "https://www.sf.gov/news-mayor-lurie-supervisors-announce-legislation-to-support-neighborhoods-small-businesses-with-five-new-entertainment-zones#4dc21ef3":
    {
      url: "https://www.sf.gov/news-mayor-lurie-supervisors-announce-legislation-to-support-neighborhoods-small-businesses-with-five-new-entertainment-zones",
      title:
        "Mayor Lurie, Supervisors Announce Legislation to Support Neighborhoods, Small Businesses with Five New Entertainment Zones",
      publisher: "SF.gov (Office of the Mayor)",
      snippet:
        "…the nightlife corridor of Folsom Street in SoMa, we’re creating welcoming spaces that support small businesses…",
      fetchedAt: 1794526026000,
    },
  "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#0c198ca1": {
    url: "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco",
    title: "The Best Streets for Bar Hopping in San Francisco",
    publisher: "San Francisco Travel Association",
    snippet: "This strip on the edge of SoMa is home to many incredible clubs.",
    fetchedAt: 1794526026000,
  },
  "https://www.sf.gov/perfect-day-north-beach#9a035a6c": {
    url: "https://www.sf.gov/perfect-day-north-beach",
    title: "Perfect Day in North Beach",
    publisher: "SF.gov (Office of Economic and Workforce Development)",
    snippet:
      "Grant Avenue is rich with one-of-a-kind shops, while Broadway is lined with music clubs, restaurants and bars.",
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/North_Beach,_San_Francisco#7222dbd4": {
    url: "https://en.wikipedia.org/wiki/North_Beach,_San_Francisco",
    title: "North Beach, San Francisco",
    publisher: "Wikipedia",
    snippet:
      "Broadway east of Columbus Avenue still serves as one of the city's main nightclub districts and offers restaurants, blues clubs, strip clubs, nightclubs…",
    fetchedAt: 1794526026000,
  },
  "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#4ff1258f": {
    url: "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco",
    title: "The Best Streets for Bar Hopping in San Francisco",
    publisher: "San Francisco Travel Association",
    snippet:
      "…Vesuvio (255 Columbus Ave.), where the Beat poets used to gather for drinks, as well as Tosca Café (242 Columbus Ave.)",
    fetchedAt: 1794526026000,
  },
  "https://www.sf.gov/perfect-day-castro#c4856f6d": {
    url: "https://www.sf.gov/perfect-day-castro",
    title: "Perfect Day in the Castro",
    publisher: "SF.gov (Office of Economic and Workforce Development)",
    snippet:
      "…Visit one of our many bars - from wine to dancing to classic history spots, the Castro Merchants have got you covered.",
    fetchedAt: 1794526026000,
  },
  "https://www.sf.gov/news-mayor-lurie-signs-legislation-creating-five-new-entertainment-zones-across-san-francisco-launches-castro-entertainment-zone#de88925b":
    {
      url: "https://www.sf.gov/news-mayor-lurie-signs-legislation-creating-five-new-entertainment-zones-across-san-francisco-launches-castro-entertainment-zone",
      title:
        "Mayor Lurie Signs Legislation Creating Five New Entertainment Zones Across San Francisco, Launches Castro Entertainment Zone",
      publisher: "SF.gov (Office of the Mayor)",
      snippet:
        "…such a large entertainment zone footprint—it reflects the broad scope of our neighborhood and gives dozens of bars and restaurants more opportunities to shine",
      fetchedAt: 1794526026000,
    },
  "https://www.sf.gov/castro-upper-market-entertainment-zone#e71227e6": {
    url: "https://www.sf.gov/castro-upper-market-entertainment-zone",
    title: "Castro Upper Market Entertainment Zone",
    publisher: "SF.gov (San Francisco Entertainment Zones)",
    snippet: "On Castro Street and various streets in the Castro neighborhood",
    fetchedAt: 1794526026000,
  },
  "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#d85d1229": {
    url: "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco",
    title: "The Best Streets for Bar Hopping in San Francisco",
    publisher: "San Francisco Travel Association",
    snippet:
      "…Lookout (3600 16th St.)…The Café (2369 Market St.)…Moby Dick (4049 18th St.), a Castro landmark.",
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/Marina_District,_San_Francisco#e8ffbc34": {
    url: "https://en.wikipedia.org/wiki/Marina_District,_San_Francisco",
    title: "Marina District, San Francisco",
    publisher: "Wikipedia",
    snippet:
      "Stretching from Fillmore Street down to Lyon Street, Chestnut is lined with a collection of stores, restaurants, bakeries, coffee shops and bars.",
    fetchedAt: 1794526026000,
  },
  "https://www.sf.gov/perfect-day-along-chestnut-st#a8abad55": {
    url: "https://www.sf.gov/perfect-day-along-chestnut-st",
    title: "Perfect Day along Chestnut St.",
    publisher: "SF.gov (Office of Economic and Workforce Development)",
    snippet:
      "End your night at the Horseshoe Tavern, a classic San Francisco watering hole, complete with good beer, pool, and the constant cast of regulars.",
    fetchedAt: 1794526026000,
  },
  "https://www.sftravel.com/article/where-to-eat-drink-marina-district#501e39e0": {
    url: "https://www.sftravel.com/article/where-to-eat-drink-marina-district",
    title: "Where to Eat and Drink in the Marina District",
    publisher: "San Francisco Travel Association",
    snippet:
      "Union Street and Chestnut Street, running parallel to one another through the Marina, are home to…hip cocktail lounges, and historic watering holes",
    fetchedAt: 1794526026000,
  },
  "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#5df85687": {
    url: "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco",
    title: "The Best Streets for Bar Hopping in San Francisco",
    publisher: "San Francisco Travel Association",
    snippet:
      "This Marina District stretch has a distinctly casual collegiate vibe with its many sports bars and local watering holes.",
    fetchedAt: 1794526026000,
  },
  "https://www.sf.gov/perfect-day-along-union-st#5d283082": {
    url: "https://www.sf.gov/perfect-day-along-union-st",
    title: "Perfect Day along Union St.",
    publisher: "SF.gov (Office of Economic and Workforce Development)",
    snippet:
      "also caters to the younger generation with gyms, cycle shops, yoga and spas…boutiques, sports bars and coffee shops.",
    fetchedAt: 1794526026000,
  },
  "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#1a4764e2": {
    url: "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco",
    title: "The Best Streets for Bar Hopping in San Francisco",
    publisher: "San Francisco Travel Association",
    snippet:
      "Stretching from the Castro to the Marina, Divisadero is packed with hip bars and cocktail lounges that make for some top-notch bar hopping.",
    fetchedAt: 1794526026000,
  },
  "https://www.sftravel.com/article/where-to-eat-drink-san-franciscos-nopa#c05b4f6e": {
    url: "https://www.sftravel.com/article/where-to-eat-drink-san-franciscos-nopa",
    title: "Where to Eat and Drink in San Francisco's NOPA",
    publisher: "San Francisco Travel Association",
    snippet: "Open until 1 a.m., Horsefeather is great spot for a late-night bite.",
    fetchedAt: 1794526026000,
  },
  "https://www.sf.gov/perfect-day-haight#fbaebe5d": {
    url: "https://www.sf.gov/perfect-day-haight",
    title: "Perfect Day in the Haight",
    publisher: "SF.gov (Office of Economic and Workforce Development)",
    snippet:
      "Finish your night with a cocktail at Zam Zam, The Gold Cane, Mary's on Haight and more!",
    fetchedAt: 1794526026000,
  },
  "https://www.sfmta.com/travel-updates/haight-ashbury-street-fair-sunday-september-20-2026#c1d0a3b0":
    {
      url: "https://www.sfmta.com/travel-updates/haight-ashbury-street-fair-sunday-september-20-2026",
      title: "Haight Ashbury Street Fair: Sunday, September 20, 2026",
      publisher: "SFMTA",
      snippet:
        "…an annual event featuring arts and crafts, food vendors, three musical stages and more.…on Haight Street between Masonic and Stanyan",
      fetchedAt: 1794526026000,
    },
  "https://en.wikipedia.org/wiki/Haight-Ashbury#8c6ec54a": {
    url: "https://en.wikipedia.org/wiki/Haight-Ashbury",
    title: "Haight-Ashbury",
    publisher: "Wikipedia",
    snippet:
      "The Haight-Ashbury Street Fair started in 1978 and is held each year.…Haight Street is closed to vehicular traffic between Stanyan and Masonic",
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/Lower_Haight,_San_Francisco#1a8583e2": {
    url: "https://en.wikipedia.org/wiki/Lower_Haight,_San_Francisco",
    title: "Lower Haight, San Francisco",
    publisher: "Wikipedia",
    snippet:
      "A mixture of restaurants, small nightclubs, cafes, drinking establishments, residences, galleries, and hair salons characterizes the Lower Haight.",
    fetchedAt: 1794526026000,
  },
  "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#e37c7cc9": {
    url: "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco",
    title: "The Best Streets for Bar Hopping in San Francisco",
    publisher: "San Francisco Travel Association",
    snippet:
      "…NOC NOC (557 Haight St.)…Molotov's (582 Haight St.) before heading over to Nickie's (466 Haight St.) for some dancing.",
    fetchedAt: 1794526026000,
  },
  "https://www.sfsu.edu/student-experience/our-san-francisco-campus#bfe8b57f": {
    url: "https://www.sfsu.edu/student-experience/our-san-francisco-campus",
    title: "Our San Francisco Campus",
    publisher: "San Francisco State University",
    snippet:
      "Spanning 144 acres, the SFSU campus is a lush, green oasis in the city, with tree-lined pathways",
    fetchedAt: 1794526026000,
  },
  "https://www.sfsu.edu/about/facts-and-figures#a2d746ea": {
    url: "https://www.sfsu.edu/about/facts-and-figures",
    title: "Facts and Figures",
    publisher: "San Francisco State University",
    snippet:
      "Over 17,000 undergraduates and 3,000 graduate students and post-baccalaureates are currently enrolled",
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/San_Francisco_State_University#25aa21a9": {
    url: "https://en.wikipedia.org/wiki/San_Francisco_State_University",
    title: "San Francisco State University - Wikipedia",
    publisher: "Wikipedia",
    snippet:
      "The 144.1-acre main campus is located in the southwest part of the city, less than two miles from the Pacific coast.",
    fetchedAt: 1794526026000,
  },
  "https://www.usfca.edu/who-we-are/our-locations/san-francisco-main-campus#7c7c1166": {
    url: "https://www.usfca.edu/who-we-are/our-locations/san-francisco-main-campus",
    title: "San Francisco Main Campus | University of San Francisco",
    publisher: "University of San Francisco",
    snippet:
      'The main campus of the University of San Francisco, "the Hilltop" is located on 55 acres in the Inner Richmond neighborhood.',
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/University_of_San_Francisco#7c079d47": {
    url: "https://en.wikipedia.org/wiki/University_of_San_Francisco",
    title: "University of San Francisco - Wikipedia",
    publisher: "Wikipedia",
    snippet:
      "It's divided into Lone Mountain and lower campus, which are north and south of Turk Street respectively",
    fetchedAt: 1794526026000,
  },
  "https://realestate.ucsf.edu/campus-sites/parnassus-heights-campus-site#a1a73201": {
    url: "https://realestate.ucsf.edu/campus-sites/parnassus-heights-campus-site",
    title: "Parnassus Heights Campus Site | UCSF Real Estate",
    publisher: "UCSF",
    snippet:
      "Parnassus Heights is the oldest and largest campus site belonging to UC San Francisco. It comprises approximately 107 acres of land at the base of Mount Sutro…",
    fetchedAt: 1794526026000,
  },
  "https://medschool.ucsf.edu/about/overview/campuses-and-directions#e6126280": {
    url: "https://medschool.ucsf.edu/about/overview/campuses-and-directions",
    title: "Campuses and Directions | UCSF School of Medicine",
    publisher: "UCSF",
    snippet:
      "The school is headquartered at the central Parnassus Heights campus on Parnassus Avenue near Fourth Avenue, adjacent to the UCSF Medical Center.",
    fetchedAt: 1794526026000,
  },
  "https://realestate.ucsf.edu/campus-sites/mission-bay-campus-site#220795f5": {
    url: "https://realestate.ucsf.edu/campus-sites/mission-bay-campus-site",
    title: "Mission Bay Campus Site | UCSF Real Estate",
    publisher: "UCSF",
    snippet:
      "The 57.9-acre UCSF Mission Bay campus site is within the Mission Bay South Redevelopment Area…",
    fetchedAt: 1794526026000,
  },
  "https://medicine.ucsf.edu/about/locations/ucsf-medical-center-parnassus-mount-zion-mission-bay#92e5c2a2":
    {
      url: "https://medicine.ucsf.edu/about/locations/ucsf-medical-center-parnassus-mount-zion-mission-bay",
      title: "UCSF Medical Center at Parnassus, Mount Zion, Mission Bay | Department of Medicine",
      publisher: "UCSF",
      snippet:
        "In 2015, UCSF Medical Center expanded to Mission Bay, bringing health care to children, women and cancer patients",
      fetchedAt: 1794526026000,
    },
  "https://realestate.ucsf.edu/campus-sites/mount-zion#eaca7ca7": {
    url: "https://realestate.ucsf.edu/campus-sites/mount-zion",
    title: "Mount Zion | UCSF Real Estate",
    publisher: "UCSF",
    snippet:
      "The UCSF Mount Zion campus site is approximately 7.5 acres on six contiguous city blocks in the Western Addition neighborhood of San Francisco.",
    fetchedAt: 1794526026000,
  },
  "https://medicine.ucsf.edu/about/locations/ucsf-medical-center-parnassus-mount-zion-mission-bay#3499e55d":
    {
      url: "https://medicine.ucsf.edu/about/locations/ucsf-medical-center-parnassus-mount-zion-mission-bay",
      title: "UCSF Medical Center at Parnassus, Mount Zion, Mission Bay | Department of Medicine",
      publisher: "UCSF",
      snippet:
        "The UCSF Medical Center is made up of three medical centers, at the Parnassus, Mount Zion and Mission Bay campuses.",
      fetchedAt: 1794526026000,
    },
  "https://generalplan.sfplanning.org/Balboa_Park_Station.htm#07469b0d": {
    url: "https://generalplan.sfplanning.org/Balboa_Park_Station.htm",
    title: "Balboa Park Station | San Francisco General Plan",
    publisher: "SF Planning",
    snippet:
      "The Ocean Avenue Campus is the historical heart of the CCSF system and continues to serve as its flagship campus, serving the majority of its students.",
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/City_College_of_San_Francisco#c815fe64": {
    url: "https://en.wikipedia.org/wiki/City_College_of_San_Francisco",
    title: "City College of San Francisco - Wikipedia",
    publisher: "Wikipedia",
    snippet:
      "The Ocean Avenue campus, bordering the Sunnyside, Westwood Park and Ingleside neighborhoods, is the college's largest location.",
    fetchedAt: 1794526026000,
  },
  "https://www.uclawsf.edu/map-directions/#63cedc43": {
    url: "https://www.uclawsf.edu/map-directions/",
    title: "Map & Directions - UC Law SF College of the Law, San Francisco",
    publisher: "UC Law SF",
    snippet:
      "The law school’s academic and residential buildings stand astride two blocks of McAllister Street",
    fetchedAt: 1794526026000,
  },
  "https://www.uclawsf.edu/#c1072ec8": {
    url: "https://www.uclawsf.edu/",
    title: "UC Law San Francisco | (Formerly UC Hastings)",
    publisher: "UC Law SF",
    snippet: "The Civic Center is home to UC Law SF, as well as City Hall, courthouses…",
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/University_of_California_College_of_the_Law,_San_Francisco#4051581a":
    {
      url: "https://en.wikipedia.org/wiki/University_of_California_College_of_the_Law,_San_Francisco",
      title: "University of California College of the Law, San Francisco - Wikipedia",
      publisher: "Wikipedia",
      snippet:
        "…UC Law SF) is a public law school in San Francisco. It was formerly known as the University of California, Hastings College of the Law (UC Hastings).",
      fetchedAt: 1794526026000,
    },
  "https://sfcm.edu/experience/facilities#41cc0479": {
    url: "https://sfcm.edu/experience/facilities",
    title: "Facilities | SFCM",
    publisher: "San Francisco Conservatory of Music",
    snippet:
      "The Conservatory's 50 Oak Street campus, the Ann Getty Center for Education,…the Ute and William K. Bowes Center for the Performing Arts at 200 Van Ness Avenue",
    fetchedAt: 1794526026000,
  },
  "https://sfcm.edu/discover/campus-life/bowes-center#bcd67ed1": {
    url: "https://sfcm.edu/discover/campus-life/bowes-center",
    title: "The Bowes Center | SFCM",
    publisher: "San Francisco Conservatory of Music",
    snippet: "Apartments for over 400 student-musicians, learn about living on campus.",
    fetchedAt: 1794526026000,
  },
  "https://sfcm.edu/study/apply/getting-here#b131ac16": {
    url: "https://sfcm.edu/study/apply/getting-here",
    title: "Getting To SFCM | SFCM",
    publisher: "San Francisco Conservatory of Music",
    snippet:
      "The SFCM campus consists of two buildings: the Ann Getty Center for Education and the Ute and William K. Bowes, Jr. Center for Performing Arts…",
    fetchedAt: 1794526026000,
  },
  "https://cca.edu/about/vanderbilt-agreement/#d4c04a2a": {
    url: "https://cca.edu/about/vanderbilt-agreement/",
    title: "Vanderbilt Agreement | CCA",
    publisher: "California College of the Arts",
    snippet:
      "Under the terms of this agreement, CCA plans to continue teaching and supporting students through the 2026–27 academic year",
    fetchedAt: 1794526026000,
  },
  "https://cca.edu/about/vanderbilt-agreement/#9342584c": {
    url: "https://cca.edu/about/vanderbilt-agreement/",
    title: "Vanderbilt Agreement | CCA",
    publisher: "California College of the Arts",
    snippet:
      "…CCA will wind down its current operations and will close by the end of the 2026-2027 academic year. Vanderbilt will then become the owner of the campus",
    fetchedAt: 1794526026000,
  },
  "https://www.cca.edu/#39c86dc5": {
    url: "https://www.cca.edu/",
    title: "CCA | California College of the Arts - Bay Area Art & Design School",
    publisher: "California College of the Arts",
    snippet: "CCA will close in June 2027. Read about the agreement with Vanderbilt University.",
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/California_College_of_the_Arts#f8518f52": {
    url: "https://en.wikipedia.org/wiki/California_College_of_the_Arts",
    title: "California College of the Arts - Wikipedia",
    publisher: "Wikipedia",
    snippet:
      "…the college will be closing at the end of the 2026–2027 academic year, with Vanderbilt University taking over the campus.",
    fetchedAt: 1794526026000,
  },
  "https://www.academyart.edu/facilities/#188b8f18": {
    url: "https://www.academyart.edu/facilities/",
    title: "Facilities - Academy of Art University",
    publisher: "Academy of Art University",
    snippet:
      "Free for all students and staff members, our shuttle service is designed to get you efficiently and safely around our urban campus in San Francisco.",
    fetchedAt: 1794526026000,
  },
  "https://en.wikipedia.org/wiki/Academy_of_Art_University#9831c3ff": {
    url: "https://en.wikipedia.org/wiki/Academy_of_Art_University",
    title: "Academy of Art University - Wikipedia",
    publisher: "Wikipedia",
    snippet:
      "The school is one of the largest property owners in San Francisco, with the main campus located on New Montgomery Street in the South of Market district.",
    fetchedAt: 1794526026000,
  },
  "https://ggu.edu/2026/06/09/golden-gate-university-expands-san-francisco-presence-across-two-campuses/#f3b6c34c":
    {
      url: "https://ggu.edu/2026/06/09/golden-gate-university-expands-san-francisco-presence-across-two-campuses/",
      title:
        "Golden Gate University Expands San Francisco Presence Across Two Campuses | Golden Gate University",
      publisher: "Golden Gate University",
      snippet:
        "Beginning this Fall semester,…GGU’s Downtown Campus, located in San Francisco’s Academic Village at UC Law SF, and GGU’s Lake Merced Campus…",
      fetchedAt: 1794526026000,
    },
  "https://ggu.edu/2026/06/09/golden-gate-university-expands-san-francisco-presence-across-two-campuses/#abbddcb0":
    {
      url: "https://ggu.edu/2026/06/09/golden-gate-university-expands-san-francisco-presence-across-two-campuses/",
      title:
        "Golden Gate University Expands San Francisco Presence Across Two Campuses | Golden Gate University",
      publisher: "Golden Gate University",
      snippet:
        "GGU’s new downtown location, at the UC Law SF Academic Village at 333 Golden Gate Avenue, marks a return to these roots.",
      fetchedAt: 1794526026000,
    },
};

export const CORRIDORS: readonly CorridorSeed[] = [
  {
    key: "corridor:valencia-street",
    name: "Valencia Street (Mission)",
    detail:
      "Bars, restaurants and live-music venues like The Chapel line Valencia from about 15th to 22nd; its entertainment zone (16th-21st) runs daily to 11:59 PM.",
    path: [
      {
        lat: 37.766551,
        lng: -122.422067,
      },
      {
        lat: 37.764916,
        lng: -122.421906,
      },
      {
        lat: 37.761699,
        lng: -122.421595,
      },
      {
        lat: 37.758504,
        lng: -122.421284,
      },
      {
        lat: 37.755303,
        lng: -122.420972,
      },
    ],
    sources: [
      "https://www.sf.gov/valencia-street-entertainment-zone#47234a4d",
      "https://en.wikipedia.org/wiki/Mission_District,_San_Francisco#949fbcd1",
      "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#2753ab02",
    ],
  },
  {
    key: "corridor:polk-street",
    name: "Polk Street (Polk Gulch)",
    detail:
      "Polk Street through Polk Gulch (about Geary to Union) is a bar-hopping street full of shops, restaurants and entertainment.",
    path: [
      {
        lat: 37.785903,
        lng: -122.419757,
      },
      {
        lat: 37.786833,
        lng: -122.419945,
      },
      {
        lat: 37.790584,
        lng: -122.420701,
      },
      {
        lat: 37.795954,
        lng: -122.421786,
      },
      {
        lat: 37.798766,
        lng: -122.422355,
      },
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Polk_Street#ada03fcf",
      "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#c297b864",
      "https://www.sf.gov/perfect-day-along-polk-st#a8bc2e80",
    ],
  },
  {
    key: "corridor:western-soma-11th-folsom",
    name: "Western SoMa: Folsom Street and 11th Street",
    detail:
      "Dance clubs line the 11th Street corridor (DNA Lounge, Audio, Halcyon) and Folsom (1015 Folsom; Raven Bar, Cat Club, F8 in the 7th-8th St entertainment zone).",
    path: [
      {
        lat: 37.778508,
        lng: -122.405631,
      },
      {
        lat: 37.774993,
        lng: -122.410083,
      },
      {
        lat: 37.77282,
        lng: -122.412834,
      },
      {
        lat: 37.771862,
        lng: -122.414049,
      },
      {
        lat: 37.770644,
        lng: -122.412478,
      },
    ],
    sources: [
      "https://www.sf.gov/perfect-day-soma-west#b846f4ec",
      "https://www.sf.gov/folsom-street-entertainment-zone#99401d95",
      "https://www.sf.gov/news-mayor-lurie-supervisors-announce-legislation-to-support-neighborhoods-small-businesses-with-five-new-entertainment-zones#4dc21ef3",
      "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#0c198ca1",
    ],
  },
  {
    key: "corridor:broadway-columbus",
    name: "Broadway and Columbus Avenue (North Beach)",
    detail:
      "Broadway east of Columbus is one of SF's main nightclub districts, lined with music clubs, bars and strip clubs; Vesuvio and Tosca Cafe sit on Columbus.",
    path: [
      {
        lat: 37.797072,
        lng: -122.405542,
      },
      {
        lat: 37.797868,
        lng: -122.406688,
      },
      {
        lat: 37.79802,
        lng: -122.405498,
      },
      {
        lat: 37.798228,
        lng: -122.403878,
      },
    ],
    sources: [
      "https://www.sf.gov/perfect-day-north-beach#9a035a6c",
      "https://en.wikipedia.org/wiki/North_Beach,_San_Francisco#7222dbd4",
      "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#4ff1258f",
    ],
  },
  {
    key: "corridor:castro-upper-market",
    name: "Castro Street, 18th Street and Upper Market (Castro)",
    detail:
      "The Castro has dozens of bars, from wine to dancing, e.g. Lookout (16th St), The Cafe (Market) and Moby Dick (18th); its entertainment zone covers Castro St.",
    path: [
      {
        lat: 37.764205,
        lng: -122.433101,
      },
      {
        lat: 37.762671,
        lng: -122.435199,
      },
      {
        lat: 37.760891,
        lng: -122.435014,
      },
      {
        lat: 37.76103,
        lng: -122.432816,
      },
    ],
    sources: [
      "https://www.sf.gov/perfect-day-castro#c4856f6d",
      "https://www.sf.gov/news-mayor-lurie-signs-legislation-creating-five-new-entertainment-zones-across-san-francisco-launches-castro-entertainment-zone#de88925b",
      "https://www.sf.gov/castro-upper-market-entertainment-zone#e71227e6",
      "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#d85d1229",
    ],
  },
  {
    key: "corridor:chestnut-street",
    name: "Chestnut Street (Marina)",
    detail:
      "Chestnut St west of Fillmore is lined with stores, restaurants and bars, from cocktail lounges to watering holes like the Horseshoe Tavern.",
    path: [
      {
        lat: 37.80082,
        lng: -122.436263,
      },
      {
        lat: 37.800611,
        lng: -122.437908,
      },
      {
        lat: 37.800193,
        lng: -122.441196,
      },
      {
        lat: 37.799981,
        lng: -122.442864,
      },
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Marina_District,_San_Francisco#e8ffbc34",
      "https://www.sf.gov/perfect-day-along-chestnut-st#a8abad55",
      "https://www.sftravel.com/article/where-to-eat-drink-marina-district#501e39e0",
    ],
  },
  {
    key: "corridor:union-street-cow-hollow",
    name: "Union Street (Cow Hollow)",
    detail:
      "Union Street in Cow Hollow has a casual collegiate vibe, with many sports bars and local watering holes alongside cocktail lounges.",
    path: [
      {
        lat: 37.79814,
        lng: -122.427288,
      },
      {
        lat: 37.797722,
        lng: -122.430575,
      },
      {
        lat: 37.797095,
        lng: -122.435509,
      },
      {
        lat: 37.796886,
        lng: -122.437152,
      },
    ],
    sources: [
      "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#5df85687",
      "https://www.sf.gov/perfect-day-along-union-st#5d283082",
      "https://www.sftravel.com/article/where-to-eat-drink-marina-district#501e39e0",
    ],
  },
  {
    key: "corridor:divisadero-nopa",
    name: "Divisadero Street (NoPa)",
    detail:
      "Divisadero is packed with hip bars and cocktail lounges for bar hopping; in NoPa, Horsefeather is open until 1 a.m. for a late-night bite.",
    path: [
      {
        lat: 37.771275,
        lng: -122.437064,
      },
      {
        lat: 37.774072,
        lng: -122.43763,
      },
      {
        lat: 37.775003,
        lng: -122.437818,
      },
      {
        lat: 37.776866,
        lng: -122.438194,
      },
      {
        lat: 37.7778,
        lng: -122.438383,
      },
    ],
    sources: [
      "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#1a4764e2",
      "https://www.sftravel.com/article/where-to-eat-drink-san-franciscos-nopa#c05b4f6e",
    ],
  },
  {
    key: "corridor:upper-haight",
    name: "Haight Street (Upper Haight / Haight-Ashbury)",
    detail:
      "Upper Haight has cocktail bars like Zam Zam and The Gold Cane; its annual street fair (since 1978) closes Haight, Masonic to Stanyan, with three music stages.",
    path: [
      {
        lat: 37.769385,
        lng: -122.451882,
      },
      {
        lat: 37.769804,
        lng: -122.448594,
      },
      {
        lat: 37.770021,
        lng: -122.446952,
      },
      {
        lat: 37.770223,
        lng: -122.445365,
      },
    ],
    sources: [
      "https://www.sf.gov/perfect-day-haight#fbaebe5d",
      "https://www.sfmta.com/travel-updates/haight-ashbury-street-fair-sunday-september-20-2026#c1d0a3b0",
      "https://en.wikipedia.org/wiki/Haight-Ashbury#8c6ec54a",
    ],
  },
  {
    key: "corridor:lower-haight",
    name: "Haight Street (Lower Haight)",
    detail:
      "Lower Haight mixes small nightclubs and drinking spots, such as Nickie's (466 Haight), NOC NOC (557) and Molotov's (582), with residences.",
    path: [
      {
        lat: 37.771696,
        lng: -122.433751,
      },
      {
        lat: 37.771906,
        lng: -122.43211,
      },
      {
        lat: 37.772113,
        lng: -122.430461,
      },
      {
        lat: 37.772326,
        lng: -122.428818,
      },
    ],
    sources: [
      "https://en.wikipedia.org/wiki/Lower_Haight,_San_Francisco#1a8583e2",
      "https://www.sftravel.com/article/best-streets-bar-hopping-san-francisco#e37c7cc9",
    ],
  },
];

export const CAMPUSES: readonly CampusSeed[] = [
  {
    key: "campus:sfsu",
    name: "San Francisco State University (main campus)",
    institution: "San Francisco State University",
    detail:
      "SF State's 144-acre main campus in the southwest part of the city, with over 17,000 undergraduates and 3,000 graduate students and post-baccalaureates enrolled.",
    point: {
      lat: 37.724517,
      lng: -122.479996,
    },
    sources: [
      "https://www.sfsu.edu/student-experience/our-san-francisco-campus#bfe8b57f",
      "https://www.sfsu.edu/about/facts-and-figures#a2d746ea",
      "https://en.wikipedia.org/wiki/San_Francisco_State_University#25aa21a9",
    ],
  },
  {
    key: "campus:usf-hilltop",
    name: "University of San Francisco Hilltop Campus (Lone Mountain and lower campus)",
    institution: "University of San Francisco",
    detail:
      'USF\'s 55-acre main campus, "the Hilltop," divided into Lone Mountain and the lower campus, north and south of Turk Street respectively.',
    point: {
      lat: 37.779363,
      lng: -122.451447,
    },
    sources: [
      "https://www.usfca.edu/who-we-are/our-locations/san-francisco-main-campus#7c7c1166",
      "https://en.wikipedia.org/wiki/University_of_San_Francisco#7c079d47",
    ],
  },
  {
    key: "campus:ucsf-parnassus-heights",
    name: "UCSF Parnassus Heights",
    institution: "University of California, San Francisco",
    detail:
      "UCSF's oldest and largest campus site, about 107 acres at the base of Mount Sutro, where the School of Medicine is headquartered on Parnassus Avenue.",
    point: {
      lat: 37.762953,
      lng: -122.459768,
    },
    sources: [
      "https://realestate.ucsf.edu/campus-sites/parnassus-heights-campus-site#a1a73201",
      "https://medschool.ucsf.edu/about/overview/campuses-and-directions#e6126280",
    ],
  },
  {
    key: "campus:ucsf-mission-bay",
    name: "UCSF Mission Bay",
    institution: "University of California, San Francisco",
    detail:
      "UCSF's 57.9-acre Mission Bay campus site, where UCSF Medical Center expanded in 2015 to bring health care to children, women and cancer patients.",
    point: {
      lat: 37.768711,
      lng: -122.392219,
    },
    sources: [
      "https://realestate.ucsf.edu/campus-sites/mission-bay-campus-site#220795f5",
      "https://medicine.ucsf.edu/about/locations/ucsf-medical-center-parnassus-mount-zion-mission-bay#92e5c2a2",
    ],
  },
  {
    key: "campus:ucsf-mount-zion",
    name: "UCSF Mount Zion",
    institution: "University of California, San Francisco",
    detail:
      "UCSF's Mount Zion campus site, about 7.5 acres on six contiguous city blocks, is home to one of the three medical centers that make up UCSF Medical Center.",
    point: {
      lat: 37.784325,
      lng: -122.4397,
    },
    sources: [
      "https://realestate.ucsf.edu/campus-sites/mount-zion#eaca7ca7",
      "https://medicine.ucsf.edu/about/locations/ucsf-medical-center-parnassus-mount-zion-mission-bay#3499e55d",
    ],
  },
  {
    key: "campus:ccsf-ocean",
    name: "City College of San Francisco Ocean Campus",
    institution: "City College of San Francisco",
    detail:
      "City College of San Francisco's Ocean Avenue Campus, the college's largest location and flagship campus, serving the majority of its students.",
    point: {
      lat: 37.723926,
      lng: -122.451532,
    },
    sources: [
      "https://generalplan.sfplanning.org/Balboa_Park_Station.htm#07469b0d",
      "https://en.wikipedia.org/wiki/City_College_of_San_Francisco#c815fe64",
    ],
  },
  {
    key: "campus:uc-law-sf",
    name: "UC Law San Francisco (formerly UC Hastings)",
    institution: "University of California College of the Law, San Francisco",
    detail:
      "UC Law SF (formerly UC Hastings), a public law school in the Civic Center whose academic and residential buildings stand astride two blocks of McAllister St.",
    point: {
      lat: 37.780726,
      lng: -122.415339,
    },
    sources: [
      "https://www.uclawsf.edu/map-directions/#63cedc43",
      "https://www.uclawsf.edu/#c1072ec8",
      "https://en.wikipedia.org/wiki/University_of_California_College_of_the_Law,_San_Francisco#4051581a",
    ],
  },
  {
    key: "campus:sfcm",
    name: "San Francisco Conservatory of Music",
    institution: "San Francisco Conservatory of Music",
    detail:
      "SFCM's campus is the Ann Getty Center at 50 Oak St and the Bowes Center at 200 Van Ness Ave, which has apartments for over 400 student-musicians.",
    point: {
      lat: 37.775539,
      lng: -122.420394,
    },
    sources: [
      "https://sfcm.edu/experience/facilities#41cc0479",
      "https://sfcm.edu/discover/campus-life/bowes-center#bcd67ed1",
      "https://sfcm.edu/study/apply/getting-here#b131ac16",
    ],
  },
  {
    key: "campus:cca-san-francisco",
    name: "California College of the Arts (San Francisco campus)",
    institution: "California College of the Arts",
    detail:
      "CCA's San Francisco campus is in its final year: CCA plans to keep teaching through 2026-27, will close in June 2027, and Vanderbilt will take over the campus.",
    point: {
      lat: 37.767859,
      lng: -122.400602,
    },
    sources: [
      "https://cca.edu/about/vanderbilt-agreement/#d4c04a2a",
      "https://cca.edu/about/vanderbilt-agreement/#9342584c",
      "https://www.cca.edu/#39c86dc5",
      "https://en.wikipedia.org/wiki/California_College_of_the_Arts#f8518f52",
    ],
  },
  {
    key: "campus:academy-of-art-university",
    name: "Academy of Art University (79 New Montgomery St main building)",
    institution: "Academy of Art University",
    detail:
      "Academy of Art University's urban campus of buildings linked by free shuttles; its main campus is on New Montgomery Street in South of Market.",
    point: {
      lat: 37.787903,
      lng: -122.400781,
    },
    sources: [
      "https://www.academyart.edu/facilities/#188b8f18",
      "https://en.wikipedia.org/wiki/Academy_of_Art_University#9831c3ff",
    ],
  },
  {
    key: "campus:ggu-downtown",
    name: "Golden Gate University Downtown Campus",
    institution: "Golden Gate University",
    detail:
      "From fall 2026, GGU's Downtown Campus is in UC Law SF's Academic Village at 333 Golden Gate Ave; its Lake Merced Campus is co-located with SF State.",
    point: {
      lat: 37.781342,
      lng: -122.416222,
    },
    sources: [
      "https://ggu.edu/2026/06/09/golden-gate-university-expands-san-francisco-presence-across-two-campuses/#f3b6c34c",
      "https://ggu.edu/2026/06/09/golden-gate-university-expands-san-francisco-presence-across-two-campuses/#abbddcb0",
    ],
  },
];
