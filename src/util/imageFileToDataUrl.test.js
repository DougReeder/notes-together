// imageFileToDataUrl.test.js - unit tests for image transcoding
// Copyright © 2017-2021 Doug Reeder

import {imageFileToDataUrl} from "./imageFileToDataUrl";
import {dataURItoFile} from "./testUtil";


describe("imageFileToDataUrl", () => {
  it("should return small SVG unchanged & file name as alt text", async () => {
    const svgDataUri = 'data:image/svg+xml;base64,PHN2ZyB4bWxuczp4PSJodHRwOi8vbnMuYWRvYmUuY29tL0V4dGVuc2liaWxpdHkvMS4wLyIgeG1sbnM6aT0iaHR0cDovL25zLmFkb2JlLmNvbS9BZG9iZUlsbHVzdHJhdG9yLzEwLjAvIiB4bWxuczpncmFwaD0iaHR0cDovL25zLmFkb2JlLmNvbS9HcmFwaHMvMS4wLyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdmVyc2lvbj0iMS4xIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iLTk0OSA5NTEgMTAwIDEyNSIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAtOTQ5IDk1MSAxMDAgMTAwOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CiAgICA8c3dpdGNoPjxmb3JlaWduT2JqZWN0IHJlcXVpcmVkRXh0ZW5zaW9ucz0iaHR0cDovL25zLmFkb2JlLmNvbS9BZG9iZUlsbHVzdHJhdG9yLzEwLjAvIiB4PSIwIiB5PSIwIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PGcgaTpleHRyYW5lb3VzPSJzZWxmIj48Zz4KICAgICAgICA8cG9seWdvbiBwb2ludHM9Ii04NjMuMyw5OTguMSAtODc4LjUsOTgxLjEgLTkwNi4xLDEwMTMuMSAtOTE5LjQsMTAwMC4zIC05MzQuNywxMDE1LjMgLTkzNC43LDEwMzYuNyAtODYzLjMsMTAzNi43ICAgICIgZmlsbD0iI2ZmZiIvPgogICAgICAgIDxwYXRoIGQ9Ik0tOTQ2LjUsOTUzLjV2OTVoOTV2LTk1SC05NDYuNXogTS04NTguNiwxMDQxLjRoLTgwLjl2LTgwLjloODAuOVYxMDQxLjR6IiBmaWxsPSIjZmZmIi8+CiAgICAgICAgPGNpcmNsZSBjeD0iLTkyMiIgY3k9Ijk3OCIgcj0iOCIgZmlsbD0iI2ZmZiIvPgogICAgPC9nPjwvZz48L3N3aXRjaD4KICAgIDwhLS0gQ3JlYXRlZCBieSBBZHJpZW4gQ29xdWV0IC0tPgogICAgPCEtLSBmcm9tIHRoZSBOb3VuIFByb2plY3QgLS0+Cjwvc3ZnPg==';
    const svgFile = dataURItoFile(svgDataUri, "picture.icon.svg");

    const {dataUrl, alt} = await imageFileToDataUrl(svgFile);

    expect(dataUrl).toEqual(svgDataUri);
    expect(alt).toEqual("picture.icon.svg");
  });

  // it("should return small JPEG unchanged", async () => {
  //   const jpegDataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAADAAcDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABcQAAMBAAAAAAAAAAAAAAAAAAABITH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8ATmAf/9k=';
  //   const jpegFile = dataURItoFile(jpegDataUri, "small.jpeg");
  //
  //
  //   const {dataUrl, alt} = await imageFileToDataUrl(jpegFile);
  //
  //   expect(dataUrl).toEqual(jpegDataUri);
  //   expect(alt).toEqual("small");
  // });
});
