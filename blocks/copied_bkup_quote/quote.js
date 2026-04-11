export default function decorate(block) {
    block.innerHTML = `<em>${block.innerHTML}</em>`;
}