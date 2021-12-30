// Copyright © 2021 Doug Reeder under the MIT License

import {addSubstitution, clearSubstitutions, currentSubstitutions} from "./urlSubstitutions";

const svg = `<svg version="1.1" width="300" height="200" xmlns="http://www.w3.org/2000/svg">
<circle cx="150" cy="100" r="80" fill="green" />
</svg>`;

const dataUrlSvg = 'data:image/svg+xml;base64,' + btoa(svg);


afterEach(() => {
  jest.restoreAllMocks();
});

describe("urlSubstitutions", () => {
  it("should initially be empty", async () => {
    expect(await currentSubstitutions()).toEqual(new Map());
  });

  it("should cache substitutions and clear them", async () => {
    const blob = new Blob([svg], {type: 'image/svg+xml'});
    jest.spyOn(global, 'fetch').mockImplementation(() => {
      return Promise.resolve(new Response(blob))
    });
    // const dataUrl = await fileToDataUrl(blob);
    // expect(dataUrl).toEqual(dataUrlSvg);
    const objectUrl = 'blob:http://192.168.1.5:3000/2fd265e6-86f4-4826-9fc6-98812c4b0bb5';

    addSubstitution(objectUrl);

    const substitutions = await currentSubstitutions();
    expect(substitutions.size).toEqual(1);
    expect(substitutions.get(objectUrl)).toEqual(dataUrlSvg);

    clearSubstitutions();
    expect(await currentSubstitutions()).toEqual(new Map());
  });

  it("should handle errors", async () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => {
      return Promise.reject("probe")
    });
    const objectUrl = 'blob:http://192.168.1.5:3000/2fd265e6-86f4-4826-9fc6-98812c4b0bb5';

    addSubstitution(objectUrl);

    expect(await currentSubstitutions()).toEqual(new Map());
  });
});


