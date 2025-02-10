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

    // Fetch XML data first
    const apiUrl7 = `https://pico.geodan.nl/cgi-bin/qgis_mapserv.fcgi?DPI=120&map=/usr/lib/cgi-bin/projects/gebouw_woningtype.qgs&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&CRS=EPSG%3A28992&WIDTH=937&HEIGHT=842&LAYERS=gebouw&QUERY_LAYERS=gebouw&INFO_FORMAT=text/xml&I=611&J=469&FEATURE_COUNT=10&bbox=${target3}`;

    console.log("Fetching XML data from URL7...");
    const xmlResponse = await fetch(apiUrl7);
    const xmlData = await xmlResponse.text();
    console.log("XML data fetched successfully!");

    // Define API URLs for JSON data
    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v5/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&&SRSNAME=urn:ogc:def:crs:EPSG::28992&bbox=${target3}`;
    const encodedTarget1 = encodeURIComponent(target1);
    const apiUrl5 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=wfs&version=2.0.0&request=getfeature&typeName=bag:verblijfsobject&outputformat=application/json&srsName=EPSG:4326&filter=%3Cfes:Filter%20xmlns:fes=%22http://www.opengis.net/fes/2.0%22%20xmlns:xsi=%22http://www.w3.org/2001/XMLSchema-instance%22%20xsi:schemaLocation=%22http://www.opengis.net/wfs/2.0%20http://schemas.opengis.net/wfs/2.0/wfs.xsd%22%3E%3Cfes:PropertyIsEqualTo%3E%3Cfes:PropertyName%3Eidentificatie%3C/fes:PropertyName%3E%3Cfes:Literal%3E${encodedTarget1}%3C/fes:Literal%3E%3C/fes:PropertyIsEqualTo%3E%3C/fes:Filter%3E`;

    const fetchWithErrorHandling = async (url, options = {}) => {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        return { error: "error" };
      }
    };

    // Fetch JSON data in parallel
    const [data0, data1, data2, data5] = await Promise.all([
      fetchWithErrorHandling(apiUrl0),
      fetchWithErrorHandling(apiUrl1, { headers: { Authorization: process.env.AUTH_TOKEN } }),
      fetchWithErrorHandling(apiUrl2),
      fetchWithErrorHandling(apiUrl5)
    ]);

    // Extract coordinates
    const [x, y] = target2.split(",").map(coord => parseFloat(coord));

    // More API URLs
     const apiUrl3 = `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&QUERY_LAYERS=Perceelvlak&layers=Perceelvlak&INFO_FORMAT=application/json&FEATURE_COUNT=1&I=2&J=2&CRS=EPSG:28992&STYLES=&WIDTH=5&HEIGHT=5&BBOX=${target3}`;
    const response3 = await fetchWithErrorHandling(apiUrl3, { headers: { 'Content-Type': 'application/json' } });

    const apiUrl4 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&propertyname=&count=200&outputFormat=json&srsName=EPSG:4326&typeName=bag:verblijfsobject&Filter=<Filter><DWithin><PropertyName>Geometry</PropertyName><gml:Point><gml:coordinates>${x},${y}</gml:coordinates></gml:Point><Distance units='m'>70</Distance></DWithin></Filter>`;
    const response4 = await fetchWithErrorHandling(apiUrl4, { headers: { 'Content-Type': 'application/json' } });

  const apiUrl6 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&count=200&outputFormat=application/json&srsName=EPSG:4326&typeName=bag:pand&Filter=%3CFilter%3E%20%3CDWithin%3E%3CPropertyName%3EGeometry%3C/PropertyName%3E%3Cgml:Point%3E%20%3Cgml:coordinates%3E${x},${y}%3C/gml:coordinates%3E%20%3C/gml:Point%3E%3CDistance%20units=%27m%27%3E70%3C/Distance%3E%3C/DWithin%3E%3C/Filter%3E`;
    // Fetch additional data
    const [data3, data4, data6] = await Promise.all([
      fetchWithErrorHandling(apiUrl3),
      fetchWithErrorHandling(apiUrl4),
      fetchWithErrorHandling(apiUrl6)
    ]);

    // Process data4 features
    const data4Features = data4.features || [];

    // Fetch additional information for features
    const additionalData = await Promise.all(
      data4Features.map(async feature => {
        const identificatie = feature.properties?.identificatie;
        if (!identificatie) return null;

        const apiUrl = `https://yxorp-pi.vercel.app/api/handler?url=https://public.ep-online.nl/api/v4/PandEnergielabel/AdresseerbaarObject/${identificatie}`;

        try {
          const response = await fetch(apiUrl, {
            headers: { Authorization: process.env.AUTH_TOKEN }
          });

          if (response.ok) {
            const data = await response.json();
            return { identificatie, data };
          } else {
            return { identificatie, error: response.statusText };
          }
        } catch (error) {
          return { identificatie, error: error.message };
        }
      })
    );

    // Merge data
    const additionalDataMap = new Map();
    additionalData.filter(item => item !== null).forEach(item => {
      additionalDataMap.set(item.identificatie, item);
    });

    const mergedData = data4Features
      .map(feature => {
        const identificatie = feature.properties?.identificatie;
        const additionalInfo = additionalDataMap.get(identificatie);
        const pandData = data6.features.find(pand => pand.properties?.identificatie === feature.properties?.pandidentificatie);

        if (!additionalInfo || additionalInfo.error || !pandData) return null;

        return {
          ...feature,
          additionalData: additionalInfo.data,
          additionalData2: [{ geometry: pandData.geometry }]
        };
      })
      .filter(item => item !== null);

    // Construct combined data object
    const combinedData = {
      LOOKUP: data0,
      EPON: data1,
      NETB: data2,
      KADAS: data3,
      OBJECT: data5,
      MERGED: mergedData
    };

    console.log("MERGED is now fully constructed:", mergedData.length);

    // Return response with JSON + XML
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
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
