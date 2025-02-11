export default async function handler(req, res) {
  try {
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

    // ... (Existing code for fetching xmlData)

    const apiUrl0 = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/lookup?id=${target0}`;
    const apiUrl1 = `https://public.ep-online.nl/api/v5/PandEnergielabel/AdresseerbaarObject/${target1}`;
    const apiUrl2 = `https://opendata.polygonentool.nl/wfs?service=wfs&version=2.0.0&request=getfeature&typename=se:OGC_Warmtevlak,se:OGC_Elektriciteitnetbeheerdervlak,se:OGC_Gasnetbeheerdervlak,se:OGC_Telecomvlak,se:OGC_Waternetbeheerdervlak,se:OGC_Rioleringsvlakken&propertyname=name,disciplineCode&outputformat=application/json&&SRSNAME=urn:ogc:def:crs:EPSG::28992&bbox=${target3}`;
    const encodedTarget1 = encodeURIComponent(target1);
    const apiUrl5 = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=wfs&version=2.0.0&request=getfeature&typeName=bag:verblijfsobject&outputformat=application/json&srsName=EPSG:4326&filter=%3Cfes:Filter%20xmlns:fes=%22http://www.opengis.net/fes/2.0%22%20xmlns:xsi=%22http://www.w3.org/2001/XMLSchema-instance%22%20xsi:schemaLocation=%22http://www.opengis.net/wfs/2.0%20http://schemas.opengis.net/wfs/2.0/wfs.xsd%22%3E%3Cfes:PropertyIsEqualTo%3E%3Cfes:PropertyName%3Eidentificatie%3C/fes:PropertyName%3E%3Cfes:Literal%3E${encodedTarget1}%3C/fes:Literal%3E%3C/fes:PropertyIsEqualTo%3E%3C/fes:Filter%3E`;

    const fetchWithErrorHandling = async (url, options = {}) => {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const errorText = await response.text(); // Get error details if available
          throw new Error(`HTTP error! Status: ${response.status} - ${errorText} for ${url}`);
        }
        return await response.json();
      } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        return { error: error.message };
      }
    };

    const [data0, data1, data2, data5] = await Promise.all([
      fetchWithErrorHandling(apiUrl0),
      fetchWithErrorHandling(apiUrl1, { headers: { Authorization: process.env.AUTH_TOKEN } }),
      fetchWithErrorHandling(apiUrl2),
      fetchWithErrorHandling(apiUrl5)
    ]);

    console.log("data0:", data0);

    if (data0 && data0.error) {
      console.error("Error fetching data0:", data0.error);
      data0 = { error: data0.error }; // Or: data0 = {}; or: throw new Error(data0.error);
    }

    // ... (Existing code for fetching data3, data4, data6)

    const data4Features = data4?.features || [];

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
            const errorText = await response.text(); // Capture error details
            console.error(`Error fetching additional data for ${identificatie}: ${response.status} ${response.statusText} - ${errorText}`);
            return { identificatie, error: response.statusText };
          }
        } catch (error) {
          console.error(`Error fetching additional data for ${identificatie}: ${error.message}`);
          return { identificatie, error: error.message };
        }
      })
    );

    const additionalDataMap = new Map(
      additionalData.filter(item => item !== null && !item.error).map(item => [item.identificatie, item.data])
    );

    const mergedData = data4Features.map(feature => {
      const identificatie = feature.properties?.identificatie;
      const additionalInfo = additionalDataMap.get(identificatie);
      const pandData = data6?.features?.find(pand => pand.properties?.identificatie === feature.properties?.pandidentificatie);

      if (additionalInfo && pandData) {
        return {
          ...feature,
          additionalData: additionalInfo,
          additionalData2: [{ geometry: pandData.geometry }]
        };
      } else {
        if (!additionalInfo) console.log(`Missing additionalInfo for ${identificatie}`);
        if (!pandData) console.log(`Missing pandData for ${feature.properties?.pandidentificatie}`);
        return null;
      }
    }).filter(item => item !== null);


    const combinedData = {
      LOOKUP: data0 && !data0.error ? data0 : { error: "Could not retrieve LOOKUP data" },
      EPON: data1,
      NETB: data2,
      KADAS: data3,
      OBJECT: data5,
      MERGED: mergedData
    };

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
