<?php
header('Content-Type: application/json');
$code = $_GET['code'] ?? '';
if (!$code) {
  echo json_encode(['error' => 'Missing country code']);
  exit;
}
$endpoints = [
  "https://restcountries.com/v3.1/alpha/{code}",
  "https://restcountries.com/v2/alpha/{code}",
  "https://restcountries.com/v3.1/name/{name}?fullText=true"
];
$response = null;
$countryData = null;
foreach ($endpoints as $endpoint) {
  $url = str_replace('{code}', $code, $endpoint);
  $response = @file_get_contents($url);
  
  if ($response !== false) {
    $data = json_decode($response, true);
    if (isset($data[0])) {
      $countryData = $data[0];
      break;
    } elseif (isset($data['name'])) {
      $countryData = $data;
      break;
    }
  }
}
if (!$countryData) {
  $geoJsonFile = 'data/countryBorders.geo.json';
  if (file_exists($geoJsonFile)) {
    $geoJson = json_decode(file_get_contents($geoJsonFile), true);
    foreach ($geoJson['features'] as $feature) {
      if ($feature['properties']['iso_a2'] === $code || 
          $feature['properties']['iso_a3'] === $code) {
        $countryData = [
          'name' => ['common' => $feature['properties']['name']],
          'cca2' => $feature['properties']['iso_a2'],
          'cca3' => $feature['properties']['iso_a3']
        ];
        break;
      }
    }
  }
}

if (!$countryData) {
  echo json_encode(['error' => 'Country not found']);
  exit;
}
$countryData['name'] = $countryData['name'] ?? ['common' => 'Unknown'];
$countryData['capital'] = $countryData['capital'] ?? ['N/A'];
$countryData['currencies'] = $countryData['currencies'] ?? null;
$countryData['population'] = $countryData['population'] ?? 0;
$countryData['region'] = $countryData['region'] ?? 'N/A';
$countryData['subregion'] = $countryData['subregion'] ?? 'N/A';
$countryData['flags'] = $countryData['flags'] ?? ['png' => ''];
echo json_encode($countryData);
?>