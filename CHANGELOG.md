# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 26/11/2026

### Added
- **Messages** with a sender, text and an optional attachment.
- **Catch-up**: a device that was absent receives everything it missed after **one** sync, in time order, with
  nothing duplicated — and `missing(since)` reports the interval rather than guessing.
- **The bulletin**: only the host can edit it, a non-host is refused with the host's name, and it reaches
  every member on the next sync.
- **Low-power mode** that refuses images and voice notes, and says why, while words still go through.
- Refusals: no group name, no host, no sender, an empty message, a sync between two different groups.
- An unreadable group is reported and offered for export, **never** replaced with an empty one — an empty
  group looks like everyone went quiet.
- A failed save says **NOT SAVED** and leaves the group unchanged.
- PWA shell, CI (55 engine assertions + 20 in jsdom + page smoke), and the app-builder pipeline pinned to the
  canonical SHA for the EXE/APK/Linux release.

### Fixed
- **The sequence is assigned at merge, not at post.** Two devices both numbered their first message `#1`, so
  the first sync silently dropped one. A message now carries a unique id and the sequence is a property of the
  merged group, ordered by time then id.

### Not built
- The LAN transport, and encryption. Messages are plain text on each device.
