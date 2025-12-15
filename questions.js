window.TrackTricksData = {
  maps: [
    { id: "map01", label: "Full Throttle 01", image: "assets/maps/map01.jpg" },
    { id: "map02", label: "Full Throttle 02", image: "assets/maps/map02.jpg" },
    { id: "map03", label: "Full Throttle 03", image: "assets/maps/map03.jpg" },
    { id: "map04", label: "Full Throttle 04", image: "assets/maps/map04.jpg" },
    { id: "map05", label: "Full Throttle 05", image: "assets/maps/map05.jpg" },
    { id: "map06", label: "Full Throttle 06", image: "assets/maps/map06.jpg" },
    { id: "map07", label: "Full Throttle 07", image: "assets/maps/map07.jpg" },
    { id: "map08", label: "Full Throttle 08", image: "assets/maps/map08.jpg" },
    { id: "map09", label: "Full Throttle 09", image: "assets/maps/map09.jpg" },
    { id: "map10", label: "Full Throttle 10", image: "assets/maps/map10.jpg" },
    { id: "map11", label: "Full Throttle 11", image: "assets/maps/map11.jpg" },
    { id: "map12", label: "Full Throttle 12", image: "assets/maps/map12.jpg" },
    { id: "map13", label: "Full Throttle 13", image: "assets/maps/map13.jpg" },
    { id: "map14", label: "Full Throttle 14", image: "assets/maps/map14.jpg" },
    { id: "map15", label: "Full Throttle 15", image: "assets/maps/map15.jpg" },
    { id: "map16", label: "Full Throttle 16", image: "assets/maps/map16.jpg" },
    { id: "map17", label: "Full Throttle 17", image: "assets/maps/map17.jpg" },
    { id: "map18", label: "Full Throttle 18", image: "assets/maps/map18.jpg" },
    { id: "map19", label: "Full Throttle 19", image: "assets/maps/map19.jpg" },
    { id: "map20", label: "Full Throttle 20", image: "assets/maps/map20.jpg" },
    { id: "map21", label: "Full Throttle 21", image: "assets/maps/map21.jpg" },
    { id: "map22", label: "Full Throttle 22", image: "assets/maps/map22.jpg" },
    { id: "map23", label: "Full Throttle 23", image: "assets/maps/map23.jpg" },
    { id: "map24", label: "Full Throttle 24", image: "assets/maps/map24.jpg" },
    { id: "map25", label: "Full Throttle 25", image: "assets/maps/map25.jpg" },
  ],
  questions: [
    { id: "q1", text: "Welke map heeft de beste decoratie?", polarity: "positive" },
    { id: "q2", text: "Welke map heeft de beste flow?", polarity: "positive" },
    { id: "q3", text: "Welke map heeft de slechtste bocht?", polarity: "negative" },
    // Voorbeeld: alleen blauwe maps toestaan (06-10) bij deze vraag
    {
      id: "q4",
      text: "Welke blauwe map is het leukst?",
      polarity: "positive",
      // Alleen blauwe maps: 11 t/m 15
      allowedIds: ["map11", "map12", "map13", "map14", "map15"],
    },
    // Voeg hier je vragen toe (polarity: 'positive' of 'negative')
  ],
};
