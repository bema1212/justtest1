export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const { target0, target1, target2, target3 } = req.query;

    if (!target0 || !target1 || !target2 || !target3) {
      return res.status(400).json({ error: "All target parameters are required" });
    }

    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v5/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&SRSNAME=urn:ogc:def:crs:EPSG::28992&bbox=${target3}`;
    const apiUrl5 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=wfs&version=2.0.0&request=getfeature&typeName=bag:verblijfsobject&outputformat=application/json&srsName=EPSG:4326&filter=<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo><fes:PropertyName>identificatie</fes:PropertyName><fes:Literal>${encodeURIComponent(target1)}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>`;

    // Fetch JSON data in parallel
    const [data0, data1, data2, data5] = await Promise.all([
      fetchWithErrorHandling(apiUrl0, { headers: { "Content-Type": "application/json" } }),
      fetchWithErrorHandling(apiUrl1, { headers: { Authorization: process.env.AUTH_TOKEN } }),
      fetchWithErrorHandling(apiUrl2, { headers: { "Content-Type": "application/json" } }),
      fetchWithErrorHandling(apiUrl5, { headers: { "Content-Type": "application/json" } }),
    ]);

    // Extract coordinates from target2 (assumed to be in format "x,y")
    const [x, y] = target2.split(',').map(coord => parseFloat(coord));

    const apiUrl3 = `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&QUERY_LAYERS=Perceelvlak&layers=Perceelvlak&INFO_FORMAT=application/json&FEATURE_COUNT=1&I=2&J=2&CRS=EPSG:28992&WIDTH=5&HEIGHT=5&BBOX=${target3}`;
    const apiUrl4 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=200&outputFormat=json&srsName=EPSG:4326&typeName=bag:verblijfsobject&Filter=<Filter><DWithin><PropertyName>Geometry</PropertyName><gml:Point><gml:coordinates>${x},${y}</gml:coordinates></gml:Point><Distance units='m'>70</Distance></DWithin></Filter>`;
    const apiUrl6 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=200&outputFormat=application/json&srsName=EPSG:4326&typeName=bag:pand&Filter=<Filter><DWithin><PropertyName>Geometry</PropertyName><gml:Point><gml:coordinates>${x},${y}</gml:coordinates></gml:Point><Distance units='m'>70</Distance></DWithin></Filter>`;

    const [data3, data4, data6] = await Promise.all([
      fetchWithErrorHandling(apiUrl3),
      fetchWithErrorHandling(apiUrl4),
      fetchWithErrorHandling(apiUrl6),
    ]);

    // Handle XML fetch separately
    const apiUrlXML = `https://pico.geodan.nl/cgi-bin/qgis_mapserv.fcgi?DPI=120&map=/usr/lib/cgi-bin/projects/gebouw_woningtype.qgs&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&CRS=EPSG%3A28992&WIDTH=937&HEIGHT=842&LAYERS=gebouw&QUERY_LAYERS=gebouw&INFO_FORMAT=text/xml&I=611&J=469&FEATURE_COUNT=10&bbox=${target3}`;
 

const fetchXMLWithRetry = async (apiUrlXML, retries = 2) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.text(); // Return raw XML response
    xmlData = await fetchXMLWithRetry(apiUrlXML);
    
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retrying XML fetch... (${retries} attempts left)`);
      return fetchXMLWithRetry(url, retries - 1);
    } else {
      console.error(`Failed to fetch XML from ${url}:`, error.message);
      return "<error>XML fetch failed</error>"; // Return a default XML error message
    }
  }
};



    

    // Processing MERGED Data
    const data4Features = data4.features || [];
    const additionalData = await Promise.all(data4Features.map(async (feature) => {
      const identificatie = feature.properties?.identificatie;
      if (!identificatie) return null;

      const apiUrl = `https://yxorp-pi.vercel.app/api/handler?url=https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${identificatie}`;
      try {
        const response = await fetch(apiUrl, {
          headers: { Authorization: process.env.AUTH_TOKEN }
        });
        return response.ok ? { identificatie, data: await response.json() } : null;
      } catch {
        return null;
      }
    }));

    const additionalDataMap = new Map(additionalData.filter(Boolean).map(item => [item.identificatie, item]));

    const mergedData = data4Features.map(feature => {
      const identificatie = feature.properties?.identificatie;
      const additionalInfo = additionalDataMap.get(identificatie);
      const pandData = data6.features.find(pand => pand.properties?.identificatie === feature.properties?.pandidentificatie);
      
      if (!additionalInfo || !pandData) return null;

      return {
        ...feature,
        additionalData: additionalInfo.data,
        additionalData2: [{ geometry: pandData.geometry }]
      };
    }).filter(Boolean);

    // Construct response
    const combinedData = {
      LOOKUP: data0,
      EPON: data1,
      NETB: data2,
      KADAS: data3,
      OBJECT: data5,
      MERGED: mergedData,
    };

    // Send response with XML separately
    res.setHeader("Content-Type", "multipart/mixed; boundary=boundary123");
    res.status(200).send(
      `--boundary123
Content-Type: application/json

${JSON.stringify(combinedData)}

--boundary123
Content-Type: text/xml

${xmlData}

--boundary123--`
    );

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
