# Navigation

- Restaurant links from search cards and map popups carry the full search URL in router state; restaurant back links return through history to preserve the selection and restored list position, with `/search` as the direct-visit fallback.

# Restaurant parking

- Store parking details in nullable `restaurants.parking_info`; share the parser and editor between admin and owner views so unknown is distinct from unavailable.
- Save parking through `save_restaurant_parking`, which validates admin or verified-owner access server-side, so this standalone field does not depend on the unrelated pending-profile approval flow.